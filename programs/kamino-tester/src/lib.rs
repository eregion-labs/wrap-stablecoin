use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod klend;
pub mod state;

pub use instructions::*;

declare_id!("5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT");

#[program]
pub mod kamino_tester {
    use super::*;
    use crate::errors::ErrorCode;
    use crate::klend::{deposit_reserve_liquidity_ix, redeem_reserve_collateral_ix};
    use anchor_lang::solana_program::program::invoke_signed;
    use anchor_spl::token_interface::{burn, mint_to, transfer_checked, Burn, MintTo, TransferChecked};

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;

        vault_config.bump = ctx.bumps.vault_config;
        vault_config.authority = ctx.accounts.authority.key();
        vault_config.treasury = ctx.accounts.treasury.key();
        vault_config.wrapped_mint = ctx.accounts.wrapped_mint.key();
        vault_config.wrapped_mint_bump = ctx.bumps.wrapped_mint;
        vault_config.usdc_mint = ctx.accounts.usdc_mint.key();
        vault_config.lending_market = ctx.accounts.lending_market.key();
        vault_config.reserve = ctx.accounts.reserve.key();
        vault_config.collateral_mint = ctx.accounts.collateral_mint.key();
        vault_config.collateral_vault = ctx.accounts.collateral_vault.key();
        vault_config.collateral_vault_bump = ctx.bumps.collateral_vault;
        vault_config.vault_authority_bump = ctx.bumps.vault_authority;
        vault_config.total_usdc_deposited = 0;
        vault_config.paused = false;
        vault_config.flash_mint_enabled = false;
        vault_config.flash_mint_fee_bps = 0;

        msg!(
            "Vault initialized for USDC mint: {}",
            vault_config.usdc_mint
        );
        Ok(())
    }

    pub fn wrap(ctx: Context<Wrap>, args: WrapArgs) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &mut ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();

        let authority_seeds: &[&[u8]] = &[
            b"vault_authority",
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let ix = deposit_reserve_liquidity_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.lending_market_authority.key(),
            vault_config.usdc_mint,
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.user_usdc.key(),
            ctx.accounts.collateral_vault.key(),
            ctx.accounts.collateral_token_program.key(),
            ctx.accounts.token_program.key(),
            ctx.accounts.instruction_sysvar.key(),
            args.amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault_authority.to_account_info(),
                ctx.accounts.reserve.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.usdc_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.user_usdc.to_account_info(),
                ctx.accounts.collateral_vault.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

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

        vault_config.total_usdc_deposited = vault_config
            .total_usdc_deposited
            .checked_add(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Wrapped {} USDC for user {}",
            args.amount,
            ctx.accounts.user.key()
        );
        Ok(())
    }

    pub fn unwrap(ctx: Context<Unwrap>, args: UnwrapArgs) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);
        require!(args.collateral_amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &mut ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();

        require!(
            vault_config.total_usdc_deposited >= args.amount,
            ErrorCode::InsufficientBalance
        );

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
            &[vault_config.vault_authority_bump],
        ];

        let ix = redeem_reserve_collateral_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market_authority.key(),
            vault_config.usdc_mint,
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.collateral_vault.key(),
            ctx.accounts.user_usdc.key(),
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
                ctx.accounts.usdc_mint.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.collateral_vault.to_account_info(),
                ctx.accounts.user_usdc.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        vault_config.total_usdc_deposited = vault_config
            .total_usdc_deposited
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
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market_authority.key(),
            vault_config.usdc_mint,
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
                ctx.accounts.usdc_mint.to_account_info(),
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
            "Harvested yield: {} collateral tokens redeemed to treasury",
            args.collateral_amount
        );
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.vault_config.paused = paused;
        msg!("Vault paused status set to: {}", paused);
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
        let old_authority = ctx.accounts.vault_config.authority;
        ctx.accounts.vault_config.authority = ctx.accounts.new_authority.key();
        msg!(
            "Authority transferred from {} to {}",
            old_authority,
            ctx.accounts.new_authority.key()
        );
        Ok(())
    }

    pub fn flash_mint_start(ctx: Context<FlashMintStart>, args: FlashMintStartArgs) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();

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
}
