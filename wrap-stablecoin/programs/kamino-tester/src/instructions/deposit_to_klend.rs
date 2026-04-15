use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::ErrorCode;
use crate::klend::KLEND_PROGRAM_ID;
use crate::state::{TokenConfig, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositToKlendArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct DepositToKlend<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
        constraint = !vault_config.paused @ ErrorCode::VaultPaused
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA authority for signing KLend CPI
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
    pub token_config: Account<'info, TokenConfig>,

    /// CHECK: Token vault for base token
    #[account(mut, address = token_config.token_vault)]
    pub token_vault: AccountInfo<'info>,

    /// CHECK: Base token mint
    #[account(address = vault_config.usdc_mint)]
    pub usdc_mint: AccountInfo<'info>,

    /// CHECK: KLend program
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(address = vault_config.lending_market)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: Base token KLend reserve
    #[account(mut, address = token_config.reserve)]
    pub base_reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: Reserve collateral mint
    #[account(mut, address = token_config.collateral_mint)]
    pub reserve_collateral_mint: AccountInfo<'info>,

    /// CHECK: Base token collateral vault (holds KLend kTokens)
    #[account(mut, address = token_config.collateral_vault)]
    pub base_collateral_vault: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: Collateral token program
    pub collateral_token_program: AccountInfo<'info>,

    /// CHECK: Instruction sysvar for KLend
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
}
