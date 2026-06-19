use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::constants::{KLEND_PROGRAM_ID, LENDING_MARKET_AUTH_SEED};
use crate::errors::ErrorCode;
use crate::state::{AssetConfig, KLendConfig, VaultConfig};

#[derive(Accounts)]
pub struct EnableKlend<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA authority for vault ATAs
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        seeds = [crate::pda_seeds::ASSET_CONFIG_SEED, vault_config.key().as_ref(), asset_config.token_mint.as_ref()],
        bump = asset_config.bump,
        constraint = vault_config.has_asset(&asset_config.token_mint) @ ErrorCode::AssetNotRegistered
    )]
    pub asset_config: Box<Account<'info, AssetConfig>>,

    #[account(
        init,
        payer = admin,
        space = 8 + KLendConfig::INIT_SPACE,
        seeds = [crate::pda_seeds::KLEND_CONFIG_SEED, asset_config.key().as_ref()],
        bump
    )]
    pub klend_config: Box<Account<'info, KLendConfig>>,

    /// CHECK: KLend lending market
    #[account(owner = KLEND_PROGRAM_ID @ ErrorCode::InvalidReserveOwner)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    #[account(
        seeds = [LENDING_MARKET_AUTH_SEED, lending_market.key().as_ref()],
        bump,
        seeds::program = KLEND_PROGRAM_ID
    )]
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: KLend reserve for this asset
    #[account(owner = KLEND_PROGRAM_ID @ ErrorCode::InvalidReserveOwner)]
    pub reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: KLend collateral mint
    pub collateral_mint: AccountInfo<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [crate::pda_seeds::COLLATERAL_VAULT_SEED, asset_config.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = vault_authority,
        token::token_program = collateral_token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
