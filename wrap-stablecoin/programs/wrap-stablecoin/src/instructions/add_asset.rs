use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{AssetConfig, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddAssetArgs {
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
}

#[derive(Accounts)]
pub struct AddAsset<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
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
        constraint = underlying_mint.decimals >= crate::utils::MIN_TOKEN_DECIMALS @ ErrorCode::InvalidDecimals,
        constraint = underlying_mint.decimals <= crate::utils::MAX_TOKEN_DECIMALS @ ErrorCode::InvalidDecimals,
    )]
    pub underlying_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        space = 8 + AssetConfig::INIT_SPACE,
        seeds = [crate::pda_seeds::ASSET_CONFIG_SEED, vault_config.key().as_ref(), underlying_mint.key().as_ref()],
        bump
    )]
    pub asset_config: Box<Account<'info, AssetConfig>>,

    #[account(
        init,
        payer = admin,
        seeds = [crate::pda_seeds::TOKEN_VAULT_SEED, asset_config.key().as_ref()],
        bump,
        token::mint = underlying_mint,
        token::authority = vault_authority,
        token::token_program = token_program,
    )]
    pub token_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = admin,
        seeds = [crate::pda_seeds::TREASURY_VAULT_SEED, asset_config.key().as_ref()],
        bump,
        token::mint = underlying_mint,
        token::authority = vault_authority,
        token::token_program = token_program,
    )]
    pub treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
