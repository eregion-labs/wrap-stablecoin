use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{AssetConfig, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SweepHomeSurplusArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct SweepHomeSurplus<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA authority for vault token accounts
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

    /// CHECK: Underlying mint
    #[account(address = asset_config.token_mint)]
    pub token_mint: AccountInfo<'info>,

    #[account(
        mut,
        address = asset_config.token_vault,
        constraint = token_vault.mint == asset_config.token_mint @ ErrorCode::InvalidTokenAccount,
        constraint = token_vault.owner == vault_authority.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub token_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        address = asset_config.treasury_vault,
        constraint = treasury_vault.mint == asset_config.token_mint @ ErrorCode::InvalidTokenAccount,
        constraint = treasury_vault.owner == vault_authority.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}
