#![allow(deprecated)] // Anchor 0.31 macro uses AccountInfo::realloc (renamed to resize)

use anchor_lang::prelude::*;

use crate::errors::ErrorCode;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod klend;
pub mod state;
pub mod utils;

pub use instructions::*;

declare_id!("5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT");

fn check_access(
    is_public: bool,
    admin: &Pubkey,
    user: &Pubkey,
    allowlist: Option<&Account<crate::state::Allowlist>>,
    vault_config: &Pubkey,
    program_id: &Pubkey,
    err: ErrorCode,
) -> Result<()> {
    if is_public || user == admin {
        return Ok(());
    }
    let allowlist = allowlist.ok_or(err)?;
    // The Option<Account> in the Accounts struct does not validate PDA seeds on
    // its own — Anchor only checks ownership + discriminator. Without this check
    // any caller could pass an Allowlist they seeded under a different vault
    // (e.g. one they control) to bypass the gate. Verify the passed account is
    // *this* vault's allowlist PDA.
    let expected = Pubkey::create_program_address(
        &[b"allowlist", vault_config.as_ref(), &[allowlist.bump]],
        program_id,
    )
    .map_err(|_| err)?;
    if allowlist.key() != expected {
        return Err(err.into());
    }
    if !allowlist.contains(user) {
        return Err(err.into());
    }
    Ok(())
}

#[program]
pub mod kamino_tester {
    use super::*;
    use crate::errors::ErrorCode;
    use crate::klend::{deposit_reserve_liquidity_ix, redeem_reserve_collateral_ix};
    use crate::utils::get_token_balance;
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
        vault_config.paused = false;
        vault_config.wrap_public = true;
        vault_config.unwrap_public = true;
        vault_config.flash_mint_enabled = false;
        vault_config.flash_mint_fee_bps = 0;
        vault_config.flash_mint_max_amount = 0;
        vault_config.flash_mint_fee_receiver = Pubkey::default();

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
        token_config.total_liquidity_in_klend = 0;

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
            &ctx.accounts.vault_config.admin,
            &ctx.accounts.user.key(),
            ctx.accounts.allowlist.as_ref(),
            &ctx.accounts.vault_config.key(),
            ctx.program_id,
            ErrorCode::NotAllowedToWrap,
        )?;

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

        // Snapshot vault balance so fee-on-transfer mints can't let us mint more wStable
        // than base token actually received.
        let vault_before = get_token_balance(&ctx.accounts.token_vault.to_account_info())?;

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

        let vault_after = get_token_balance(&ctx.accounts.token_vault.to_account_info())?;
        let received = vault_after
            .checked_sub(vault_before)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(received > 0, ErrorCode::InvalidAmount);

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
            received,
        )?;

        token_config.total_deposited = token_config
            .total_deposited
            .checked_add(received)
            .ok_or(ErrorCode::MathOverflow)?;

        vault_config.total_stable_deposited = vault_config
            .total_stable_deposited
            .checked_add(received)
            .ok_or(ErrorCode::MathOverflow)?;

        emit!(Wrapped {
            user: ctx.accounts.user.key(),
            token_mint: token_config.token_mint,
            amount_in: args.amount,
            amount_minted: received,
        });
        Ok(())
    }

    pub fn unwrap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Unwrap<'info>>,
        args: UnwrapArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        check_access(
            ctx.accounts.vault_config.unwrap_public,
            &ctx.accounts.vault_config.admin,
            &ctx.accounts.user.key(),
            ctx.accounts.allowlist.as_ref(),
            &ctx.accounts.vault_config.key(),
            ctx.program_id,
            ErrorCode::NotAllowedToUnwrap,
        )?;

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

        emit!(Unwrapped {
            user: ctx.accounts.user.key(),
            amount: args.amount,
        });
        Ok(())
    }

    pub fn harvest_yield(ctx: Context<HarvestYield>, args: HarvestYieldArgs) -> Result<()> {
        require!(args.collateral_amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let token_config = &ctx.accounts.token_config;
        let vault_config_key = vault_config.key();

        // Don't let admin try to redeem more kTokens than the vault holds.
        let collateral_before =
            get_token_balance(&ctx.accounts.collateral_vault.to_account_info())?;
        require!(
            args.collateral_amount <= collateral_before,
            ErrorCode::InsufficientBalance
        );

        let treasury_before = get_token_balance(&ctx.accounts.treasury.to_account_info())?;

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

        // Use the CPI itself as the exchange-rate oracle. KLend rounds liquidity_received
        // DOWN, so the implied kToken-per-USDC rate (kTokens_redeemed / liquidity_received)
        // is an UPPER bound on the true rate — this makes the backing check strictly
        // conservative. Admin has no input into the rate, so there's no rug path.
        let collateral_after = get_token_balance(&ctx.accounts.collateral_vault.to_account_info())?;
        let treasury_after = get_token_balance(&ctx.accounts.treasury.to_account_info())?;

        let ktokens_redeemed = collateral_before
            .checked_sub(collateral_after)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(ktokens_redeemed > 0, ErrorCode::HarvestRedeemedNothing);

        let liquidity_received = treasury_after
            .checked_sub(treasury_before)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(liquidity_received > 0, ErrorCode::HarvestRedeemedNothing);

        // Remaining backing value (in USDC) at the rate implied by this redemption:
        //   remaining_value = collateral_after * liquidity_received / ktokens_redeemed
        // Must cover the tracked liability (total_liquidity_in_klend).
        let remaining_value = (collateral_after as u128)
            .checked_mul(liquidity_received as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(ktokens_redeemed as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(
            remaining_value >= token_config.total_liquidity_in_klend as u128,
            ErrorCode::HarvestLeavesUnderbacked
        );

        emit!(Harvested {
            token_mint: token_config.token_mint,
            ktokens_redeemed,
            liquidity_received,
        });
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

        // Track USDC-denominated liability held in KLend so harvest_yield's cap is meaningful.
        let token_config = &mut ctx.accounts.token_config;
        token_config.total_liquidity_in_klend = token_config
            .total_liquidity_in_klend
            .checked_add(args.amount)
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

        // Snapshot vault USDC balance before redeem to measure actual liquidity returned.
        let liquidity_before = get_token_balance(&ctx.accounts.base_token_vault.to_account_info())?;

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

        // Decrement USDC tracking by actual liquidity returned. Saturates because after rate
        // appreciation we may receive more USDC than originally tracked for these kTokens; the
        // surplus is just extra vault backing and doesn't imply negative principal.
        let liquidity_after = get_token_balance(&ctx.accounts.base_token_vault.to_account_info())?;
        let liquidity_received = liquidity_after
            .checked_sub(liquidity_before)
            .ok_or(ErrorCode::MathOverflow)?;
        let token_config = &mut ctx.accounts.token_config;
        token_config.total_liquidity_in_klend = token_config
            .total_liquidity_in_klend
            .saturating_sub(liquidity_received);

        msg!(
            "Withdrew {} kTokens ({} liquidity) from KLend to vault",
            args.collateral_amount,
            liquidity_received
        );
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.vault_config.paused = paused;
        emit!(PauseChanged { paused });
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
        require!(!allowlist.contains(&pubkey), ErrorCode::AllowlistDuplicate);
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
        let new_treasury = ctx.accounts.new_treasury.key();
        require!(
            new_treasury != Pubkey::default(),
            ErrorCode::InvalidTreasury
        );
        let old_treasury = ctx.accounts.vault_config.treasury;
        ctx.accounts.vault_config.treasury = new_treasury;
        msg!("Treasury updated from {} to {}", old_treasury, new_treasury);
        Ok(())
    }

    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        let new_admin = ctx.accounts.new_admin.key();
        require!(new_admin != Pubkey::default(), ErrorCode::Unauthorized);
        ctx.accounts.vault_config.pending_admin = new_admin;
        emit!(AdminTransferProposed {
            admin: ctx.accounts.vault_config.admin,
            pending_admin: new_admin,
        });
        Ok(())
    }

    pub fn cancel_transfer_authority(ctx: Context<CancelTransferAuthority>) -> Result<()> {
        ctx.accounts.vault_config.pending_admin = Pubkey::default();
        msg!("Admin transfer proposal cancelled");
        Ok(())
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        // Reject the "default pubkey implicit default" edge-case defensively, even though
        // no one holds the private key for Pubkey::default().
        require!(
            ctx.accounts.vault_config.pending_admin != Pubkey::default(),
            ErrorCode::NoPendingTransfer
        );
        let old_admin = ctx.accounts.vault_config.admin;
        let new_admin = ctx.accounts.new_admin.key();
        ctx.accounts.vault_config.admin = new_admin;
        ctx.accounts.vault_config.pending_admin = Pubkey::default();
        emit!(AdminTransferred {
            old_admin,
            new_admin,
        });
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
            &ctx.accounts.wrapped_mint.key(),
            ctx.program_id,
        )?;

        let fee = args
            .amount
            .checked_mul(vault_config.flash_mint_fee_bps as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)?;

        // If a fee will be charged, the admin must have configured a fee receiver. Fail fast
        // instead of letting flash_mint_end revert the whole transaction at the very end.
        if fee > 0 {
            require!(
                vault_config.flash_mint_fee_receiver != Pubkey::default(),
                ErrorCode::FlashMintFeeReceiverUnset
            );
        }

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

        emit!(FlashMintStarted {
            borrower: ctx.accounts.borrower.key(),
            amount: args.amount,
            fee,
        });
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

        emit!(FlashMintEnded {
            borrower: ctx.accounts.borrower.key(),
            amount,
            fee,
        });
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

    pub fn set_flash_mint_fee_receiver(ctx: Context<SetFlashMintFeeReceiver>) -> Result<()> {
        let new_receiver = ctx.accounts.fee_receiver.key();
        let old = ctx.accounts.vault_config.flash_mint_fee_receiver;
        ctx.accounts.vault_config.flash_mint_fee_receiver = new_receiver;
        msg!(
            "Flash mint fee receiver updated from {} to {}",
            old,
            new_receiver
        );
        Ok(())
    }
}

#[event]
pub struct Wrapped {
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub amount_in: u64,
    pub amount_minted: u64,
}

#[event]
pub struct Unwrapped {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Harvested {
    pub token_mint: Pubkey,
    pub ktokens_redeemed: u64,
    pub liquidity_received: u64,
}

#[event]
pub struct FlashMintStarted {
    pub borrower: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct FlashMintEnded {
    pub borrower: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct PauseChanged {
    pub paused: bool,
}

#[event]
pub struct AdminTransferProposed {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,
}

#[event]
pub struct AdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}
