use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{Allowlist, AssetConfig, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WrapArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        constraint = !vault_config.paused @ ErrorCode::VaultPaused,
        constraint = !vault_config.mint_authority_transferred @ ErrorCode::MintAuthorityTransferred
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA authority for signing
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::ASSET_CONFIG_SEED, vault_config.key().as_ref(), asset_config.token_mint.as_ref()],
        bump = asset_config.bump,
        constraint = vault_config.has_asset(&asset_config.token_mint) @ ErrorCode::AssetNotRegistered
    )]
    pub asset_config: Box<Account<'info, AssetConfig>>,

    /// Underlying collateral mint (any supported precision).
    #[account(
        address = asset_config.token_mint,
        constraint = token_mint.decimals == asset_config.token_decimals @ ErrorCode::InvalidDecimals
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user_token.mint == asset_config.token_mint @ ErrorCode::InvalidTokenAccount,
        constraint = user_token.owner == user.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub user_token: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_wrapped.mint == vault_config.wrapped_mint @ ErrorCode::InvalidTokenAccount,
        constraint = user_wrapped.owner == user.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub user_wrapped: Box<InterfaceAccount<'info, TokenAccount>>,

    /// wrapped token mint; precision fixed at vault init (`vault_config.wrapped_decimals`).
    #[account(
        mut,
        address = vault_config.wrapped_mint,
        constraint = wrapped_mint.decimals == vault_config.wrapped_decimals @ ErrorCode::InvalidDecimals
    )]
    pub wrapped_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: Token vault - validated via asset_config
    #[account(mut, address = asset_config.token_vault)]
    pub token_vault: AccountInfo<'info>,

    /// Required when wrap_public is false. PDA seeds: [crate::pda_seeds::ALLOWLIST_SEED, vault_config.key()]
    pub allowlist: Option<Account<'info, Allowlist>>,

    pub token_program: Interface<'info, TokenInterface>,
}
