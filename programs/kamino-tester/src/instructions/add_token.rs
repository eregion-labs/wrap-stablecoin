use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{TokenConfig, VaultConfig};

#[derive(Accounts)]
pub struct AddToken<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA authority for signing token operations
    #[account(
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        space = 8 + TokenConfig::INIT_SPACE,
        seeds = [b"token_config", vault_config.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub token_config: Box<Account<'info, TokenConfig>>,

    /// CHECK: KLend reserve for this token
    pub reserve: AccountInfo<'info>,

    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: Reserve liquidity supply token account (stored for validation in wrap/unwrap)
    pub reserve_liquidity_supply: AccountInfo<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [b"token_collateral_vault", token_config.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = vault_authority,
        token::token_program = collateral_token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = admin,
        seeds = [b"token_vault", token_config.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = vault_authority,
        token::token_program = token_program,
    )]
    pub token_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
