#![allow(deprecated)] // Anchor 0.31 macro uses AccountInfo::realloc (renamed to resize)

use anchor_lang::prelude::*;

use crate::errors::ErrorCode;

pub mod errors;
pub mod instructions;
pub mod jupiter;
pub mod klend;
pub mod state;

pub use instructions::*;

declare_id!("5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT");

fn check_access(
    is_public: bool,
    authority: &Pubkey,
    user: &Pubkey,
    allowlist: Option<&Account<crate::state::Allowlist>>,
    err: ErrorCode,
) -> Result<()> {
    if is_public || user == authority {
        return Ok(());
    }
    let allowlist = allowlist.ok_or(err)?;
    if !allowlist.contains(user) {
        return Err(err.into());
    }
    Ok(())
}

#[program]
pub mod kamino_tester {
    use super::*;
    use crate::errors::ErrorCode;
    use crate::jupiter::get_token_balance;
    use crate::klend::{deposit_reserve_liquidity_ix, redeem_reserve_collateral_ix};
    use anchor_lang::solana_program::program::invoke_signed;
    use anchor_spl::token_interface::{
        burn, mint_to, transfer_checked, Burn, MintTo, TransferChecked,
    };

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;
        let token_config = &mut ctx.accounts.token_config;

        vault_config.bump = ctx.bumps.vault_config;
        vault_config.authority = ctx.accounts.authority.key();
        vault_config.admin = ctx.accounts.authority.key();
        vault_config.pending_admin = Pubkey::default();
        vault_config.treasury = ctx.accounts.treasury.key();
        vault_config.wrapped_mint = ctx.accounts.wrapped_mint.key();
        vault_config.wrapped_mint_bump = ctx.bumps.wrapped_mint;
        vault_config.vault_authority_bump = ctx.bumps.vault_authority;
        vault_config.lending_market = ctx.accounts.lending_market.key();
        vault_config.usdc_mint = ctx.accounts.usdc_mint.key();
        vault_config.total_stable_deposited = 0;
        vault_config.registered_tokens = 1;
        vault_config.paused = false;
        vault_config.wrap_public = true;
        vault_config.unwrap_public = true;
        vault_config.flash_mint_enabled = false;
        vault_config.flash_mint_fee_bps = 0;
        vault_config.flash_mint_max_amount = 0;

        token_config.bump = ctx.bumps.token_config;
        token_config.vault_config = vault_config.key();
        token_config.token_mint = ctx.accounts.usdc_mint.key();
        token_config.token_decimals = ctx.accounts.usdc_mint.decimals;
        token_config.reserve = ctx.accounts.reserve.key();
        token_config.collateral_mint = ctx.accounts.collateral_mint.key();
        token_config.collateral_vault = ctx.accounts.collateral_vault.key();
        token_config.collateral_vault_bump = ctx.bumps.collateral_vault;
        token_config.token_vault = ctx.accounts.token_vault.key();
        token_config.token_vault_bump = ctx.bumps.token_vault;
        token_config.total_deposited = 0;
        token_config.is_base_token = true;
        token_config.enabled = true;
        token_config.reserve_liquidity_supply = ctx.accounts.reserve_liquidity_supply.key();
        token_config.total_collateral_deposited = 0;

        msg!(
            "Vault initialized with base mint: {}",
            vault_config.usdc_mint
        );
        Ok(())
    }

    pub fn wrap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Wrap<'info>>,
        args: WrapArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        check_access(
            ctx.accounts.vault_config.wrap_public,
            &ctx.accounts.vault_config.authority,
            &ctx.accounts.user.key(),
            ctx.accounts.allowlist.as_ref(),
            ErrorCode::NotAllowedToWrap,
        )?;

        // Validate user token accounts
        ctx.accounts.validate_user_accounts()?;

        require!(
            ctx.accounts.token_config.is_base_token,
            ErrorCode::BaseTokenOnly
        );

        let vault_config = &mut ctx.accounts.vault_config;
        let token_config = &mut ctx.accounts.token_config;
        let vault_config_key = vault_config.key();
        let vault_authority_bump = vault_config.vault_authority_bump;
        let token_decimals = token_config.token_decimals;

        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_authority_bump],
        ];

        // Transfer input token from user to token_vault
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_token.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            args.amount,
            token_decimals,
        )?;

        // Mint wStable to user (1:1 with base token deposited)
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.user_wrapped.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            args.amount,
        )?;

        // Update totals
        token_config.total_deposited = token_config
            .total_deposited
            .checked_add(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        vault_config.total_stable_deposited = vault_config
            .total_stable_deposited
            .checked_add(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Wrapped {} tokens for user {}",
            args.amount,
            ctx.accounts.user.key()
        );
        Ok(())
    }

    pub fn unwrap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Unwrap<'info>>,
        args: UnwrapArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        check_access(
            ctx.accounts.vault_config.unwrap_public,
            &ctx.accounts.vault_config.authority,
            &ctx.accounts.user.key(),
            ctx.accounts.allowlist.as_ref(),
            ErrorCode::NotAllowedToUnwrap,
        )?;

        // Validate user token accounts
        ctx.accounts.validate_user_accounts()?;

        let vault_config = &mut ctx.accounts.vault_config;
        let base_token_config = &mut ctx.accounts.base_token_config;
        let vault_config_key = vault_config.key();
        let vault_authority_bump = vault_config.vault_authority_bump;
        let token_decimals = base_token_config.token_decimals;

        require!(
            vault_config.total_stable_deposited >= args.amount,
            ErrorCode::InsufficientBalance
        );

        // Burn wStable from user
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    from: ctx.accounts.user_wrapped.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            args.amount,
        )?;

        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_authority_bump],
        ];

        let vault_balance = get_token_balance(&ctx.accounts.base_token_vault.to_account_info())?;
        require!(
            vault_balance >= args.amount,
            ErrorCode::InsufficientLiquidity
        );

        // Transfer base token from vault to user
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.base_token_vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.user_base_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            args.amount,
            token_decimals,
        )?;

        // Update totals
        base_token_config.total_deposited = base_token_config
            .total_deposited
            .checked_sub(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        vault_config.total_stable_deposited = vault_config
            .total_stable_deposited
            .checked_sub(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Unwrapped {} wStable for user {}",
            args.amount,
            ctx.accounts.user.key()
        );
        Ok(())
    }

    pub fn harvest_yield(ctx: Context<HarvestYield>, args: HarvestYieldArgs) -> Result<()> {
        require!(args.collateral_amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let token_config = &ctx.accounts.token_config;
        let vault_config_key = vault_config.key();

        // Cap harvest to excess collateral (yield only, not user-backed deposits)
        let collateral_balance =
            get_token_balance(&ctx.accounts.collateral_vault.to_account_info())?;
        let max_harvestable = collateral_balance
            .checked_sub(token_config.total_collateral_deposited)
            .ok_or(ErrorCode::NoYieldAvailable)?;
        require!(
            args.collateral_amount <= max_harvestable,
            ErrorCode::ExceedsHarvestableYield
        );

        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let ix = redeem_reserve_collateral_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market_authority.key(),
            token_config.token_mint,
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.collateral_vault.key(),
            ctx.accounts.treasury.key(),
            ctx.accounts.collateral_token_program.key(),
            ctx.accounts.token_program.key(),
            ctx.accounts.instruction_sysvar.key(),
            args.collateral_amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault_authority.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.reserve.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.collateral_vault.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        msg!(
            "Harvested yield: {} collateral tokens from {} redeemed to treasury",
            args.collateral_amount,
            token_config.token_mint
        );
        Ok(())
    }

    pub fn deposit_to_klend(ctx: Context<DepositToKlend>, args: DepositToKlendArgs) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();
        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        // Record collateral balance before KLend deposit so we can track kTokens received.
        let collateral_before =
            get_token_balance(&ctx.accounts.base_collateral_vault.to_account_info())?;

        let ix = deposit_reserve_liquidity_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.base_reserve.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.lending_market_authority.key(),
            vault_config.usdc_mint,
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.token_vault.key(),
            ctx.accounts.base_collateral_vault.key(),
            ctx.accounts.collateral_token_program.key(),
            ctx.accounts.token_program.key(),
            ctx.accounts.instruction_sysvar.key(),
            args.amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault_authority.to_account_info(),
                ctx.accounts.base_reserve.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.usdc_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.token_vault.to_account_info(),
                ctx.accounts.base_collateral_vault.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        // Track kTokens received so harvest_yield's excess-only cap is meaningful.
        let collateral_after =
            get_token_balance(&ctx.accounts.base_collateral_vault.to_account_info())?;
        let collateral_received = collateral_after
            .checked_sub(collateral_before)
            .ok_or(ErrorCode::MathOverflow)?;
        let token_config = &mut ctx.accounts.token_config;
        token_config.total_collateral_deposited = token_config
            .total_collateral_deposited
            .checked_add(collateral_received)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Deposited {} to KLend from vault", args.amount);
        Ok(())
    }

    pub fn withdraw_from_klend(
        ctx: Context<WithdrawFromKlend>,
        args: WithdrawFromKlendArgs,
    ) -> Result<()> {
        require!(args.collateral_amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();
        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let ix = redeem_reserve_collateral_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.base_reserve.key(),
            ctx.accounts.lending_market_authority.key(),
            vault_config.usdc_mint,
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.base_collateral_vault.key(),
            ctx.accounts.base_token_vault.key(),
            ctx.accounts.collateral_token_program.key(),
            ctx.accounts.token_program.key(),
            ctx.accounts.instruction_sysvar.key(),
            args.collateral_amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault_authority.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.base_reserve.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.usdc_mint.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.base_collateral_vault.to_account_info(),
                ctx.accounts.base_token_vault.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        let token_config = &mut ctx.accounts.token_config;
        token_config.total_collateral_deposited = token_config
            .total_collateral_deposited
            .checked_sub(args.collateral_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Withdrew {} from KLend to vault", args.collateral_amount);
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.vault_config.paused = paused;
        msg!("Vault paused status set to: {}", paused);
        Ok(())
    }

    pub fn set_wrap_public(ctx: Context<SetWrapPublic>, wrap_public: bool) -> Result<()> {
        ctx.accounts.vault_config.wrap_public = wrap_public;
        msg!("Wrap public set to: {}", wrap_public);
        Ok(())
    }

    pub fn set_unwrap_public(ctx: Context<SetUnwrapPublic>, unwrap_public: bool) -> Result<()> {
        ctx.accounts.vault_config.unwrap_public = unwrap_public;
        msg!("Unwrap public set to: {}", unwrap_public);
        Ok(())
    }

    pub fn init_allowlist(ctx: Context<InitAllowlist>) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        allowlist.bump = ctx.bumps.allowlist;
        allowlist.allowed = vec![];
        msg!("Allowlist initialized");
        Ok(())
    }

    pub fn add_to_allowlist(ctx: Context<AddToAllowlist>, pubkey: Pubkey) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        require!(
            allowlist.allowed.len() < crate::state::MAX_ALLOWED,
            ErrorCode::AllowlistFull
        );
        require!(
            !allowlist.contains(&pubkey),
            ErrorCode::AllowlistDuplicate
        );
        allowlist.allowed.push(pubkey);
        msg!("Added {} to allowlist", pubkey);
        Ok(())
    }

    pub fn remove_from_allowlist(ctx: Context<RemoveFromAllowlist>, pubkey: Pubkey) -> Result<()> {
        let allowlist = &mut ctx.accounts.allowlist;
        let pos = allowlist
            .allowed
            .iter()
            .position(|k| k == &pubkey)
            .ok_or(ErrorCode::NotInAllowlist)?;
        allowlist.allowed.swap_remove(pos);
        msg!("Removed {} from allowlist", pubkey);
        Ok(())
    }

    pub fn update_treasury(ctx: Context<UpdateTreasury>) -> Result<()> {
        let old_treasury = ctx.accounts.vault_config.treasury;
        ctx.accounts.vault_config.treasury = ctx.accounts.new_treasury.key();
        msg!(
            "Treasury updated from {} to {}",
            old_treasury,
            ctx.accounts.new_treasury.key()
        );
        Ok(())
    }

    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        ctx.accounts.vault_config.pending_admin = ctx.accounts.new_admin.key();
        msg!(
            "Admin transfer proposed to {}",
            ctx.accounts.new_admin.key()
        );
        Ok(())
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        let old_admin = ctx.accounts.vault_config.admin;
        ctx.accounts.vault_config.admin = ctx.accounts.new_admin.key();
        ctx.accounts.vault_config.pending_admin = Pubkey::default();
        msg!(
            "Admin transferred from {} to {}",
            old_admin,
            ctx.accounts.new_admin.key()
        );
        Ok(())
    }

    pub fn flash_mint_start(ctx: Context<FlashMintStart>, args: FlashMintStartArgs) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();

        // Enforce flash mint max amount if configured (0 = no limit)
        if vault_config.flash_mint_max_amount > 0 {
            require!(
                args.amount <= vault_config.flash_mint_max_amount,
                ErrorCode::FlashMintAmountExceeded
            );
        }

        verify_flash_mint_end_exists(
            &ctx.accounts.instruction_sysvar,
            &ctx.accounts.borrower.key(),
            &vault_config_key,
            &ctx.accounts.flash_loan_state.key(),
            ctx.program_id,
        )?;

        let fee = args
            .amount
            .checked_mul(vault_config.flash_mint_fee_bps as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)?;

        let flash_loan_state = &mut ctx.accounts.flash_loan_state;
        flash_loan_state.bump = ctx.bumps.flash_loan_state;
        flash_loan_state.borrower = ctx.accounts.borrower.key();
        flash_loan_state.vault_config = vault_config_key;
        flash_loan_state.amount = args.amount;
        flash_loan_state.fee = fee;

        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.borrower_wrapped.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            args.amount,
        )?;

        msg!(
            "Flash mint started: {} tokens to {}, fee: {}",
            args.amount,
            ctx.accounts.borrower.key(),
            fee
        );
        Ok(())
    }

    pub fn flash_mint_end(ctx: Context<FlashMintEnd>) -> Result<()> {
        let flash_loan_state = &ctx.accounts.flash_loan_state;
        let amount = flash_loan_state.amount;
        let fee = flash_loan_state.fee;

        let total_repayment = amount.checked_add(fee).ok_or(ErrorCode::MathOverflow)?;

        require!(
            ctx.accounts.borrower_wrapped.amount >= total_repayment,
            ErrorCode::InsufficientRepayment
        );

        // Burn the principal
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    from: ctx.accounts.borrower_wrapped.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            ),
            amount,
        )?;

        // Transfer fee to treasury
        if fee > 0 {
            transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.borrower_wrapped.to_account_info(),
                        mint: ctx.accounts.wrapped_mint.to_account_info(),
                        to: ctx.accounts.fee_receiver.to_account_info(),
                        authority: ctx.accounts.borrower.to_account_info(),
                    },
                ),
                fee,
                ctx.accounts.wrapped_mint.decimals,
            )?;
        }

        msg!(
            "Flash mint completed: {} burned, {} fee paid by {}",
            amount,
            fee,
            ctx.accounts.borrower.key()
        );
        Ok(())
    }

    pub fn set_flash_mint_fee(ctx: Context<SetFlashMintFee>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 10000, ErrorCode::InvalidFlashMintFee);

        let old_fee = ctx.accounts.vault_config.flash_mint_fee_bps;
        ctx.accounts.vault_config.flash_mint_fee_bps = fee_bps;

        msg!("Flash mint fee updated from {} to {} bps", old_fee, fee_bps);
        Ok(())
    }

    pub fn set_flash_mint_enabled(ctx: Context<SetFlashMintEnabled>, enabled: bool) -> Result<()> {
        ctx.accounts.vault_config.flash_mint_enabled = enabled;
        msg!("Flash mint enabled set to: {}", enabled);
        Ok(())
    }

    pub fn set_flash_mint_max_amount(
        ctx: Context<SetFlashMintMaxAmount>,
        max_amount: u64,
    ) -> Result<()> {
        let old = ctx.accounts.vault_config.flash_mint_max_amount;
        ctx.accounts.vault_config.flash_mint_max_amount = max_amount;
        msg!(
            "Flash mint max amount updated from {} to {} (0 = no limit)",
            old,
            max_amount
        );
        Ok(())
    }
}
