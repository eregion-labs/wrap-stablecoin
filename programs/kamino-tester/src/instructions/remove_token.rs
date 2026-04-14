use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{TokenConfig, VaultConfig};

#[derive(Accounts)]
pub struct RemoveToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA authority for signing token operations
    #[account(
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [b"token_config", vault_config.key().as_ref(), token_config.token_mint.as_ref()],
        bump = token_config.bump,
        constraint = token_config.total_deposited == 0 @ ErrorCode::TokenHasDeposits,
        constraint = !token_config.is_base_token @ ErrorCode::CannotRemoveBaseToken
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"token_collateral_vault", token_config.key().as_ref()],
        bump = token_config.collateral_vault_bump,
        constraint = collateral_vault.amount == 0 @ ErrorCode::TokenHasDeposits
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"token_vault", token_config.key().as_ref()],
        bump = token_config.token_vault_bump,
        constraint = token_vault.amount == 0 @ ErrorCode::TokenHasDeposits
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
}
