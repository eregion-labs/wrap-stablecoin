use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::VaultConfig;

/// Bootstrap vault + wStable mint. Register collateral via `add_asset`; enable Kamino via `enable_klend`.
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Mint whose `decimals` field sets wStable precision (any value in 1..=18).
    #[account(
        constraint = decimals_mint.decimals >= crate::utils::MIN_TOKEN_DECIMALS @ ErrorCode::InvalidDecimals,
        constraint = decimals_mint.decimals <= crate::utils::MAX_TOKEN_DECIMALS @ ErrorCode::InvalidDecimals,
    )]
    pub decimals_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, authority.key().as_ref()],
        bump
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    #[account(
        init,
        payer = authority,
        seeds = [crate::pda_seeds::WRAPPED_MINT_SEED, vault_config.key().as_ref()],
        bump,
        mint::decimals = decimals_mint.decimals,
        mint::authority = vault_authority,
        mint::token_program = token_program,
    )]
    pub wrapped_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: PDA authority for signing token operations
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
