#![allow(deprecated)] // Anchor 0.31 macro uses AccountInfo::realloc (renamed to resize)

use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::VaultConfig;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod klend;
pub mod pda_seeds;
pub mod state;
pub mod utils;

pub use instructions::*;

declare_id!("DUKXaKc4q6DXKf6mB13iyAB5vgBRvMH8WC2qy3RGUqSJ");

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
    let expected = Pubkey::create_program_address(
        &[crate::pda_seeds::ALLOWLIST_SEED, vault_config.as_ref(), &[allowlist.bump]],
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

fn reject_reflexive_collateral(wrapped_mint: &Pubkey, underlying_mint: &Pubkey) -> Result<()> {
    require!(
        underlying_mint != wrapped_mint,
        ErrorCode::ReflexiveCollateralForbidden
    );
    Ok(())
}

fn check_mint_cap(asset_config: &crate::state::AssetConfig, mint_amount: u64) -> Result<()> {
    let new_liability = asset_config
        .net_liability()?
        .checked_add(mint_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    if asset_config.mint_cap > 0 {
        require!(
            new_liability <= asset_config.mint_cap,
            ErrorCode::MintCapExceeded
        );
    }
    if asset_config.exposure_cap > 0 {
        require!(
            new_liability <= asset_config.exposure_cap,
            ErrorCode::ExposureCapExceeded
        );
    }
    Ok(())
}

fn disable_all_asset_minting<'info>(
    vault_config: &VaultConfig,
    vault_config_key: Pubkey,
    remaining_accounts: &'info [AccountInfo<'info>],
    program_id: &Pubkey,
) -> Result<()> {
    let count = vault_config.asset_count as usize;
    require!(
        remaining_accounts.len() == count,
        ErrorCode::InvalidAssetConfigAccounts
    );

    for (i, asset_mint) in vault_config.registered_assets[..count].iter().enumerate() {
        let asset_config_info = &remaining_accounts[i];
        let (expected, _bump) = Pubkey::find_program_address(
            &[
                crate::pda_seeds::ASSET_CONFIG_SEED,
                vault_config_key.as_ref(),
                asset_mint.as_ref(),
            ],
            program_id,
        );
        require!(
            asset_config_info.key() == expected,
            ErrorCode::InvalidAssetConfigAccounts
        );

        let mut asset_config: Account<crate::state::AssetConfig> =
            Account::try_from(asset_config_info)?;
        asset_config.mint_enabled = false;
        asset_config.exit(program_id)?;
    }
    Ok(())
}

#[program]
pub mod wrap_stablecoin {
    use super::*;
    use crate::errors::ErrorCode;
    use crate::klend::{deposit_reserve_liquidity_ix, redeem_collateral, redeem_reserve_collateral_ix};
    use crate::state::AssetStatus;
    use crate::utils::{
        get_token_balance, underlying_to_wrapped_amount, wrapped_to_underlying_amount,
    };
    use anchor_lang::solana_program::program::invoke_signed;
    use anchor_spl::token_interface::{
        burn, mint_to, set_authority, transfer_checked, Burn, MintTo, SetAuthority,
        TransferChecked,
    };
    use spl_token_2022::instruction::AuthorityType;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;

        vault_config.bump = ctx.bumps.vault_config;
        vault_config.authority = ctx.accounts.authority.key();
        vault_config.admin = ctx.accounts.authority.key();
        vault_config.pending_admin = Pubkey::default();
        vault_config.wrapped_mint = ctx.accounts.wrapped_mint.key();
        vault_config.wrapped_mint_bump = ctx.bumps.wrapped_mint;
        vault_config.wrapped_decimals = ctx.accounts.decimals_mint.decimals;
        crate::utils::validate_token_decimals(vault_config.wrapped_decimals)?;
        vault_config.vault_authority_bump = ctx.bumps.vault_authority;
        vault_config.asset_count = 0;
        vault_config.registered_assets = [Pubkey::default(); crate::state::MAX_REGISTERED_ASSETS];
        vault_config.total_stable_deposited = 0;
        vault_config.paused = false;
        vault_config.wrap_public = true;
        vault_config.unwrap_public = true;
        vault_config.flash_mint_enabled = false;
        vault_config.flash_mint_fee_bps = 0;
        vault_config.flash_mint_max_amount = 0;
        vault_config.flash_mint_fee_receiver = Pubkey::default();
        vault_config.pending_mint_authority = Pubkey::default();
        vault_config.mint_authority_transferred = false;

        msg!("Vault initialized; register assets via add_asset");
        Ok(())
    }

    pub fn initialize_mint_metadata(
        ctx: Context<InitializeMintMetadata>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        initialize_mint_metadata_handler(ctx, name, symbol, uri)
    }

    pub fn add_asset(ctx: Context<AddAsset>, args: AddAssetArgs) -> Result<()> {
        crate::utils::assert_plain_collateral_mint(
            &ctx.accounts.underlying_mint.to_account_info(),
        )?;
        let vault_config = &mut ctx.accounts.vault_config;
        let asset_config = &mut ctx.accounts.asset_config;
        let mint = ctx.accounts.underlying_mint.key();

        reject_reflexive_collateral(&vault_config.wrapped_mint, &mint)?;

        asset_config.bump = ctx.bumps.asset_config;
        asset_config.vault_config = vault_config.key();
        asset_config.token_mint = mint;
        asset_config.token_decimals = ctx.accounts.underlying_mint.decimals;
        crate::utils::validate_token_decimals(asset_config.token_decimals)?;
        asset_config.treasury_vault = ctx.accounts.treasury_vault.key();
        asset_config.treasury_vault_bump = ctx.bumps.treasury_vault;
        asset_config.token_vault = ctx.accounts.token_vault.key();
        asset_config.token_vault_bump = ctx.bumps.token_vault;
        asset_config.total_deposits = 0;
        asset_config.total_wrapped_minted = 0;
        asset_config.total_redemptions = 0;
        asset_config.mint_enabled = args.mint_enabled;
        asset_config.redeem_enabled = args.redeem_enabled;
        asset_config.mint_haircut_bps = 0;
        asset_config.redemption_haircut_bps = 0;
        asset_config.mint_cap = 0;
        asset_config.exposure_cap = 0;
        asset_config.min_liquidity_target = 0;
        asset_config.asset_status = AssetStatus::Active;

        vault_config.register_asset(mint)?;

        emit!(AssetAdded { token_mint: mint });
        Ok(())
    }

    pub fn enable_klend(ctx: Context<EnableKlend>) -> Result<()> {
        let (reserve_market, reserve_mint) = {
            let data = ctx.accounts.reserve.try_borrow_data()?;
            crate::klend::parse_reserve_market_and_mint(&data)?
        };
        require_keys_eq!(
            reserve_market,
            ctx.accounts.lending_market.key(),
            ErrorCode::KlendReserveMarketMismatch
        );
        require_keys_eq!(
            reserve_mint,
            ctx.accounts.asset_config.token_mint,
            ErrorCode::KlendReserveMintMismatch
        );

        let klend_config = &mut ctx.accounts.klend_config;
        let asset_config = &ctx.accounts.asset_config;

        klend_config.bump = ctx.bumps.klend_config;
        klend_config.asset_config = asset_config.key();
        klend_config.lending_market = ctx.accounts.lending_market.key();
        klend_config.reserve = ctx.accounts.reserve.key();
        klend_config.reserve_liquidity_supply = ctx.accounts.reserve_liquidity_supply.key();
        klend_config.collateral_mint = ctx.accounts.collateral_mint.key();
        klend_config.collateral_vault = ctx.accounts.collateral_vault.key();
        klend_config.collateral_vault_bump = ctx.bumps.collateral_vault;
        klend_config.total_liquidity_in_klend = 0;

        emit!(KlendEnabled {
            token_mint: asset_config.token_mint,
        });
        Ok(())
    }

    pub fn update_asset_policy(
        ctx: Context<UpdateAssetPolicy>,
        args: UpdateAssetPolicyArgs,
    ) -> Result<()> {
        require!(args.mint_haircut_bps <= 10_000, ErrorCode::InvalidHaircut);
        require!(args.redemption_haircut_bps <= 10_000, ErrorCode::InvalidHaircut);

        let asset_config = &mut ctx.accounts.asset_config;
        asset_config.mint_enabled = args.mint_enabled;
        asset_config.redeem_enabled = args.redeem_enabled;
        asset_config.mint_haircut_bps = args.mint_haircut_bps;
        asset_config.redemption_haircut_bps = args.redemption_haircut_bps;
        asset_config.mint_cap = args.mint_cap;
        asset_config.exposure_cap = args.exposure_cap;
        asset_config.min_liquidity_target = args.min_liquidity_target;
        asset_config.asset_status = args.asset_status;

        emit!(AssetPolicyUpdated {
            token_mint: asset_config.token_mint,
        });
        Ok(())
    }

    pub fn withdraw_treasury(
        ctx: Context<WithdrawTreasury>,
        args: WithdrawTreasuryArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let asset_config = &ctx.accounts.asset_config;
        let vault_config_key = vault_config.key();

        require!(
            ctx.accounts.treasury_vault.amount >= args.amount,
            ErrorCode::InsufficientBalance
        );

        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.treasury_vault.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            args.amount,
            asset_config.token_decimals,
        )?;

        emit!(TreasuryWithdrawn {
            token_mint: asset_config.token_mint,
            destination: ctx.accounts.destination.key(),
            amount: args.amount,
        });
        Ok(())
    }

    pub fn wrap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Wrap<'info>>,
        args: WrapArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        crate::utils::assert_plain_collateral_mint(&ctx.accounts.token_mint.to_account_info())?;

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
        let asset_config = &mut ctx.accounts.asset_config;
        require!(asset_config.mint_allowed(), ErrorCode::MintDisabled);

        let vault_config_key = vault_config.key();
        let vault_authority_bump = vault_config.vault_authority_bump;
        let token_decimals = asset_config.token_decimals;
        let wrapped_decimals = vault_config.wrapped_decimals;

        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_authority_bump],
        ];

        let vault_before = get_token_balance(&ctx.accounts.token_vault.to_account_info())?;

        transfer_checked(
            CpiContext::new(
                ctx.accounts.collateral_token_program.to_account_info(),
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

        let mint_amount = underlying_to_wrapped_amount(
            received,
            token_decimals,
            wrapped_decimals,
            asset_config.mint_haircut_bps,
        )?;
        require!(mint_amount > 0, ErrorCode::InvalidAmount);
        check_mint_cap(asset_config, mint_amount)?;

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.florin_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.user_wrapped.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            mint_amount,
        )?;

        asset_config.total_deposits = asset_config
            .total_deposits
            .checked_add(received)
            .ok_or(ErrorCode::MathOverflow)?;

        asset_config.total_wrapped_minted = asset_config
            .total_wrapped_minted
            .checked_add(mint_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        vault_config.total_stable_deposited = vault_config
            .total_stable_deposited
            .checked_add(mint_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        emit!(Wrapped {
            user: ctx.accounts.user.key(),
            token_mint: asset_config.token_mint,
            amount_in: args.amount,
            amount_minted: mint_amount,
        });
        Ok(())
    }

    pub fn unwrap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Unwrap<'info>>,
        args: UnwrapArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        crate::utils::assert_plain_collateral_mint(&ctx.accounts.token_mint.to_account_info())?;

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
        let asset_config = &mut ctx.accounts.asset_config;
        require!(asset_config.redeem_allowed(), ErrorCode::RedeemDisabled);

        let vault_config_key = vault_config.key();
        let vault_authority_bump = vault_config.vault_authority_bump;
        let token_decimals = asset_config.token_decimals;
        let wrapped_decimals = vault_config.wrapped_decimals;

        require!(
            vault_config.total_stable_deposited >= args.amount,
            ErrorCode::InsufficientBalance
        );

        require!(
            args.amount <= asset_config.net_liability_saturating(),
            ErrorCode::InsufficientLiability
        );

        let out_amount = wrapped_to_underlying_amount(
            args.amount,
            token_decimals,
            wrapped_decimals,
            asset_config.redemption_haircut_bps,
        )?;
        require!(out_amount > 0, ErrorCode::InvalidAmount);

        burn(
            CpiContext::new(
                ctx.accounts.florin_token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    from: ctx.accounts.user_wrapped.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            args.amount,
        )?;

        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_authority_bump],
        ];

        let vault_balance = get_token_balance(&ctx.accounts.token_vault.to_account_info())?;
        require!(
            vault_balance >= out_amount,
            ErrorCode::InsufficientLiquidity
        );

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.collateral_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.token_vault.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.user_asset_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            out_amount,
            token_decimals,
        )?;

        asset_config.total_redemptions = asset_config
            .total_redemptions
            .checked_add(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        vault_config.total_stable_deposited = vault_config
            .total_stable_deposited
            .checked_sub(args.amount)
            .ok_or(ErrorCode::MathOverflow)?;

        emit!(Unwrapped {
            user: ctx.accounts.user.key(),
            token_mint: asset_config.token_mint,
            amount_burned: args.amount,
            amount_out: out_amount,
        });
        Ok(())
    }

    pub fn harvest_yield(ctx: Context<HarvestYield>, args: HarvestYieldArgs) -> Result<()> {
        require!(args.collateral_amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let asset_config = &ctx.accounts.asset_config;
        let klend_config = &ctx.accounts.klend_config;
        let vault_config_key = vault_config.key();

        let collateral_before =
            get_token_balance(&ctx.accounts.collateral_vault.to_account_info())?;
        require!(
            args.collateral_amount <= collateral_before,
            ErrorCode::InsufficientBalance
        );

        let treasury_before =
            get_token_balance(&ctx.accounts.treasury_vault.to_account_info())?;

        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let ix = redeem_reserve_collateral_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market_authority.key(),
            asset_config.token_mint,
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.collateral_vault.key(),
            ctx.accounts.treasury_vault.key(),
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
                ctx.accounts.treasury_vault.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        let collateral_after = get_token_balance(&ctx.accounts.collateral_vault.to_account_info())?;
        let treasury_after =
            get_token_balance(&ctx.accounts.treasury_vault.to_account_info())?;

        let ktokens_redeemed = collateral_before
            .checked_sub(collateral_after)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(ktokens_redeemed > 0, ErrorCode::HarvestRedeemedNothing);

        let liquidity_received = treasury_after
            .checked_sub(treasury_before)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(liquidity_received > 0, ErrorCode::HarvestRedeemedNothing);

        let remaining_value = (collateral_after as u128)
            .checked_mul(liquidity_received as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(ktokens_redeemed as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(
            remaining_value >= klend_config.total_liquidity_in_klend as u128,
            ErrorCode::HarvestLeavesUnderbacked
        );

        let total_kamino_value = (liquidity_received as u128)
            .checked_add(
                (collateral_after as u128)
                    .checked_mul(liquidity_received as u128)
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(ktokens_redeemed as u128)
                    .ok_or(ErrorCode::MathOverflow)?,
            )
            .ok_or(ErrorCode::MathOverflow)?;
        let principal = klend_config.total_liquidity_in_klend as u128;
        require!(total_kamino_value > principal, ErrorCode::NoYieldAvailable);
        let max_harvestable = total_kamino_value
            .checked_sub(principal)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(
            (liquidity_received as u128) <= max_harvestable,
            ErrorCode::ExceedsHarvestableYield
        );

        emit!(Harvested {
            token_mint: asset_config.token_mint,
            ktokens_redeemed,
            liquidity_received,
        });
        Ok(())
    }

    pub fn deposit_to_klend(ctx: Context<DepositToKlend>, args: DepositToKlendArgs) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let asset_config = &ctx.accounts.asset_config;
        let klend_config = &mut ctx.accounts.klend_config;

        let vault_balance = ctx.accounts.token_vault.amount;
        let remaining = vault_balance
            .checked_sub(args.amount)
            .ok_or(ErrorCode::InsufficientBalance)?;
        require!(
            remaining >= asset_config.min_liquidity_target,
            ErrorCode::InsufficientLiquidity
        );

        let vault_config_key = vault_config.key();
        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let ix = deposit_reserve_liquidity_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.lending_market_authority.key(),
            asset_config.token_mint,
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.token_vault.key(),
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
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.token_vault.to_account_info(),
                ctx.accounts.collateral_vault.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        ctx.accounts.token_vault.reload()?;
        let actual = vault_balance
            .checked_sub(ctx.accounts.token_vault.amount)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(actual > 0, ErrorCode::ZeroLiquidityDeposited);

        klend_config.total_liquidity_in_klend = klend_config
            .total_liquidity_in_klend
            .checked_add(actual)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Deposited {} of {} to KLend",
            actual,
            asset_config.token_mint
        );
        Ok(())
    }

    pub fn deposit_all_to_klend(ctx: Context<DepositAllToKlend>) -> Result<()> {
        let asset_config = &ctx.accounts.asset_config;
        let vault_balance = ctx.accounts.token_vault.amount;
        let amount = vault_balance.saturating_sub(asset_config.min_liquidity_target);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let klend_config = &mut ctx.accounts.klend_config;
        let vault_config_key = vault_config.key();
        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let ix = deposit_reserve_liquidity_ix(
            ctx.accounts.klend_program.key(),
            ctx.accounts.vault_authority.key(),
            ctx.accounts.reserve.key(),
            ctx.accounts.lending_market.key(),
            ctx.accounts.lending_market_authority.key(),
            asset_config.token_mint,
            ctx.accounts.reserve_liquidity_supply.key(),
            ctx.accounts.reserve_collateral_mint.key(),
            ctx.accounts.token_vault.key(),
            ctx.accounts.collateral_vault.key(),
            ctx.accounts.collateral_token_program.key(),
            ctx.accounts.token_program.key(),
            ctx.accounts.instruction_sysvar.key(),
            amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.vault_authority.to_account_info(),
                ctx.accounts.reserve.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.token_vault.to_account_info(),
                ctx.accounts.collateral_vault.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.instruction_sysvar.to_account_info(),
            ],
            &[authority_seeds],
        )?;

        ctx.accounts.token_vault.reload()?;
        let actual = vault_balance
            .checked_sub(ctx.accounts.token_vault.amount)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(actual > 0, ErrorCode::ZeroLiquidityDeposited);

        klend_config.total_liquidity_in_klend = klend_config
            .total_liquidity_in_klend
            .checked_add(actual)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Deposited all {} ({} reserve) of {} to KLend",
            actual,
            asset_config.min_liquidity_target,
            asset_config.token_mint
        );
        Ok(())
    }

    pub fn sweep_home_surplus(
        ctx: Context<SweepHomeSurplus>,
        args: SweepHomeSurplusArgs,
    ) -> Result<()> {
        require!(args.amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let asset_config = &ctx.accounts.asset_config;
        let vault_config_key = vault_config.key();

        let vault_balance = get_token_balance(&ctx.accounts.token_vault.to_account_info())?;
        let liability = asset_config.net_liability_saturating();
        let max_sweep = crate::utils::home_surplus_amount(
            vault_balance,
            liability,
            asset_config.token_decimals,
            vault_config.wrapped_decimals,
            asset_config.min_liquidity_target,
        )?;
        require!(max_sweep > 0, ErrorCode::NoYieldAvailable);
        require!(args.amount <= max_sweep, ErrorCode::ExceedsHomeSurplus);

        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.token_vault.to_account_info(),
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.treasury_vault.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[authority_seeds],
            ),
            args.amount,
            asset_config.token_decimals,
        )?;

        emit!(HomeSurplusSwept {
            token_mint: asset_config.token_mint,
            amount: args.amount,
        });
        Ok(())
    }

    pub fn withdraw_from_klend(
        ctx: Context<WithdrawFromKlend>,
        args: WithdrawFromKlendArgs,
    ) -> Result<()> {
        require!(args.collateral_amount > 0, ErrorCode::InvalidAmount);

        let vault_config = &ctx.accounts.vault_config;
        let asset_config = &ctx.accounts.asset_config;
        let klend_config = &mut ctx.accounts.klend_config;
        let vault_config_key = vault_config.key();
        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let liquidity_received = redeem_collateral(
            &ctx.accounts.klend_program.to_account_info(),
            &ctx.accounts.vault_authority.to_account_info(),
            &ctx.accounts.lending_market.to_account_info(),
            &ctx.accounts.reserve.to_account_info(),
            &ctx.accounts.lending_market_authority.to_account_info(),
            &ctx.accounts.token_mint.to_account_info(),
            &ctx.accounts.reserve_collateral_mint.to_account_info(),
            &ctx.accounts.reserve_liquidity_supply.to_account_info(),
            &ctx.accounts.collateral_vault.to_account_info(),
            &ctx.accounts.token_vault.to_account_info(),
            &ctx.accounts.collateral_token_program.to_account_info(),
            &ctx.accounts.token_program.to_account_info(),
            &ctx.accounts.instruction_sysvar.to_account_info(),
            &[authority_seeds],
            args.collateral_amount,
        )?;

        klend_config.total_liquidity_in_klend = klend_config
            .total_liquidity_in_klend
            .saturating_sub(liquidity_received);

        msg!(
            "Withdrew {} kTokens ({} liquidity) of {} from KLend",
            args.collateral_amount,
            liquidity_received,
            asset_config.token_mint
        );
        Ok(())
    }

    pub fn withdraw_all_from_klend(ctx: Context<WithdrawAllFromKlend>) -> Result<()> {
        let vault_config = &ctx.accounts.vault_config;
        let asset_config = &ctx.accounts.asset_config;
        let klend_config = &mut ctx.accounts.klend_config;
        let vault_config_key = vault_config.key();
        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_config.vault_authority_bump],
        ];

        let collateral_amount =
            get_token_balance(&ctx.accounts.collateral_vault.to_account_info())?;
        require!(collateral_amount > 0, ErrorCode::InvalidAmount);

        let liquidity_received = redeem_collateral(
            &ctx.accounts.klend_program.to_account_info(),
            &ctx.accounts.vault_authority.to_account_info(),
            &ctx.accounts.lending_market.to_account_info(),
            &ctx.accounts.reserve.to_account_info(),
            &ctx.accounts.lending_market_authority.to_account_info(),
            &ctx.accounts.token_mint.to_account_info(),
            &ctx.accounts.reserve_collateral_mint.to_account_info(),
            &ctx.accounts.reserve_liquidity_supply.to_account_info(),
            &ctx.accounts.collateral_vault.to_account_info(),
            &ctx.accounts.token_vault.to_account_info(),
            &ctx.accounts.collateral_token_program.to_account_info(),
            &ctx.accounts.token_program.to_account_info(),
            &ctx.accounts.instruction_sysvar.to_account_info(),
            &[authority_seeds],
            collateral_amount,
        )?;

        klend_config.total_liquidity_in_klend = klend_config
            .total_liquidity_in_klend
            .saturating_sub(liquidity_received);

        msg!(
            "Withdrew all {} kTokens ({} liquidity) of {} from KLend",
            collateral_amount,
            liquidity_received,
            asset_config.token_mint
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

    pub fn propose_mint_authority(ctx: Context<ProposeMintAuthority>) -> Result<()> {
        let new_mint_authority = ctx.accounts.new_mint_authority.key();
        require!(
            new_mint_authority != Pubkey::default(),
            ErrorCode::Unauthorized
        );
        ctx.accounts.vault_config.pending_mint_authority = new_mint_authority;
        emit!(MintAuthorityTransferProposed {
            admin: ctx.accounts.vault_config.admin,
            pending_mint_authority: new_mint_authority,
            wrapped_mint: ctx.accounts.vault_config.wrapped_mint,
        });
        Ok(())
    }

    pub fn cancel_propose_mint_authority(
        ctx: Context<CancelProposeMintAuthority>,
    ) -> Result<()> {
        ctx.accounts.vault_config.pending_mint_authority = Pubkey::default();
        msg!("Mint authority transfer proposal cancelled");
        Ok(())
    }

    pub fn accept_mint_authority<'info>(
        ctx: Context<'_, '_, 'info, 'info, AcceptMintAuthority<'info>>,
    ) -> Result<()> {
        require!(
            ctx.accounts.vault_config.pending_mint_authority != Pubkey::default(),
            ErrorCode::NoPendingMintAuthorityTransfer
        );

        let vault_config = &mut ctx.accounts.vault_config;
        let vault_config_key = vault_config.key();
        let vault_authority_bump = vault_config.vault_authority_bump;
        let new_mint_authority = ctx.accounts.new_mint_authority.key();

        let authority_seeds: &[&[u8]] = &[
            crate::pda_seeds::VAULT_AUTHORITY_SEED,
            vault_config_key.as_ref(),
            &[vault_authority_bump],
        ];

        set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.vault_authority.to_account_info(),
                    account_or_mint: ctx.accounts.wrapped_mint.to_account_info(),
                },
                &[authority_seeds],
            ),
            AuthorityType::MintTokens,
            Some(new_mint_authority),
        )?;

        disable_all_asset_minting(
            vault_config,
            vault_config_key,
            ctx.remaining_accounts,
            ctx.program_id,
        )?;

        vault_config.mint_authority_transferred = true;
        vault_config.pending_mint_authority = Pubkey::default();

        emit!(MintAuthorityTransferred {
            wrapped_mint: vault_config.wrapped_mint,
            new_mint_authority,
        });
        Ok(())
    }

    #[cfg(feature = "flash-mint")]
    include!("instructions/flash_ix_handlers.rs");
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
    pub token_mint: Pubkey,
    pub amount_burned: u64,
    pub amount_out: u64,
}

#[event]
pub struct Harvested {
    pub token_mint: Pubkey,
    pub ktokens_redeemed: u64,
    pub liquidity_received: u64,
}

#[event]
pub struct HomeSurplusSwept {
    pub token_mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TreasuryWithdrawn {
    pub token_mint: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AssetAdded {
    pub token_mint: Pubkey,
}

#[event]
pub struct KlendEnabled {
    pub token_mint: Pubkey,
}

#[event]
pub struct AssetPolicyUpdated {
    pub token_mint: Pubkey,
}

#[cfg(feature = "flash-mint")]
#[event]
pub struct FlashMintStarted {
    pub borrower: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[cfg(feature = "flash-mint")]
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

#[event]
pub struct MintAuthorityTransferProposed {
    pub admin: Pubkey,
    pub pending_mint_authority: Pubkey,
    pub wrapped_mint: Pubkey,
}

#[event]
pub struct MintAuthorityTransferred {
    pub wrapped_mint: Pubkey,
    pub new_mint_authority: Pubkey,
}
