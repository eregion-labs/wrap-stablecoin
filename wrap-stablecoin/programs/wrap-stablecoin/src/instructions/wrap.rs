use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{Allowlist, TokenConfig, VaultConfig};

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
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        constraint = !vault_config.paused @ ErrorCode::VaultPaused
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA authority for signing
    #[account(
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"token_config", vault_config.key().as_ref(), token_config.token_mint.as_ref()],
        bump = token_config.bump,
        constraint = token_config.is_base_token @ ErrorCode::TokenNotFound,
        constraint = token_config.enabled @ ErrorCode::TokenDisabled
    )]
    pub token_config: Box<Account<'info, TokenConfig>>,

    /// CHECK: Input token mint
    #[account(address = token_config.token_mint)]
    pub token_mint: AccountInfo<'info>,

    #[account(
        mut,
        constraint = user_token.mint == token_config.token_mint @ ErrorCode::InvalidTokenAccount,
        constraint = user_token.owner == user.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub user_token: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_wrapped.mint == vault_config.wrapped_mint @ ErrorCode::InvalidTokenAccount,
        constraint = user_wrapped.owner == user.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub user_wrapped: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Wrapped mint - validated via vault_config
    #[account(mut, address = vault_config.wrapped_mint)]
    pub wrapped_mint: AccountInfo<'info>,

    /// CHECK: Token vault for intermediate storage - validated via token_config
    #[account(mut, address = token_config.token_vault)]
    pub token_vault: AccountInfo<'info>,

    /// CHECK: Base token mint (USDC)
    #[account(address = vault_config.usdc_mint)]
    pub usdc_mint: AccountInfo<'info>,

    /// Required when wrap_public is false. PDA seeds: [b"allowlist", vault_config.key()]
    pub allowlist: Option<Account<'info, Allowlist>>,

    pub token_program: Interface<'info, TokenInterface>,
}
