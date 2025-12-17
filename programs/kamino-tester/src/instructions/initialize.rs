use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [b"vault_config", usdc_mint.key().as_ref()],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        init,
        payer = authority,
        seeds = [b"wrapped_mint", vault_config.key().as_ref()],
        bump,
        mint::decimals = usdc_mint.decimals,
        mint::authority = vault_authority,
        mint::token_program = token_program,
    )]
    pub wrapped_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: PDA authority for signing token operations
    #[account(
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// CHECK: KLend lending market
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend USDC reserve
    pub reserve: AccountInfo<'info>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [b"collateral_vault", vault_config.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = vault_authority,
        token::token_program = collateral_token_program,
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Treasury account to receive yield
    pub treasury: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
