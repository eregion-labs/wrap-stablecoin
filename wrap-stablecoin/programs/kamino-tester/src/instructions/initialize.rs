use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{KLEND_PROGRAM_ID, LENDING_MARKET_AUTH_SEED};
use crate::errors::ErrorCode;
use crate::state::{TokenConfig, VaultConfig};

/// Single-reserve architecture: initialize creates vault_config, wrapped_mint, and the base
/// token config (token_config, collateral_vault, token_vault) in one call.
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [b"vault_config", authority.key().as_ref()],
        bump
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    #[account(
        init,
        payer = authority,
        seeds = [b"wrapped_mint", vault_config.key().as_ref()],
        bump,
        mint::decimals = usdc_mint.decimals,
        mint::authority = vault_authority,
        mint::token_program = token_program,
    )]
    pub wrapped_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: PDA authority for signing token operations
    #[account(
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(owner = KLEND_PROGRAM_ID @ ErrorCode::InvalidReserveOwner)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA — derived from the lending market passed here.
    /// Captured once at init so the PDA constraint in deposit/withdraw/harvest is cheap.
    #[account(
        seeds = [LENDING_MARKET_AUTH_SEED, lending_market.key().as_ref()],
        bump,
        seeds::program = KLEND_PROGRAM_ID
    )]
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: Treasury account to receive yield
    pub treasury: AccountInfo<'info>,

    /// KLend reserve for the base token
    /// CHECK: Owner must be KLend; full struct validation happens at CPI time.
    #[account(owner = KLEND_PROGRAM_ID @ ErrorCode::InvalidReserveOwner)]
    pub reserve: AccountInfo<'info>,

    /// KLend reserve liquidity supply (stored in token_config for later CPI validation)
    /// CHECK: Validated by KLend; must be an SPL token account in practice.
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// KLend collateral mint for the reserve
    /// CHECK: Validated by KLend; used to constrain token::mint
    pub collateral_mint: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + TokenConfig::INIT_SPACE,
        seeds = [b"token_config", vault_config.key().as_ref(), usdc_mint.key().as_ref()],
        bump
    )]
    pub token_config: Box<Account<'info, TokenConfig>>,

    #[account(
        init,
        payer = authority,
        seeds = [b"token_collateral_vault", token_config.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = vault_authority,
        token::token_program = collateral_token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        seeds = [b"token_vault", token_config.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault_authority,
        token::token_program = token_program,
    )]
    pub token_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
