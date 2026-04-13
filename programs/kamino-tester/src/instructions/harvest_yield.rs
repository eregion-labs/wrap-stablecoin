use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::ErrorCode;
use crate::klend::KLEND_PROGRAM_ID;
use crate::state::{TokenConfig, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct HarvestYieldArgs {
    pub collateral_amount: u64,
}

#[derive(Accounts)]
pub struct HarvestYield<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA authority for signing
    #[account(
        mut,
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"token_config", vault_config.key().as_ref(), token_config.token_mint.as_ref()],
        bump = token_config.bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// CHECK: Token mint
    #[account(address = token_config.token_mint)]
    pub token_mint: AccountInfo<'info>,

    /// CHECK: Treasury account - validated against vault_config
    #[account(mut, address = vault_config.treasury)]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Token collateral vault
    #[account(mut, address = token_config.collateral_vault)]
    pub collateral_vault: AccountInfo<'info>,

    /// CHECK: KLend program
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(address = vault_config.lending_market)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: KLend reserve for this token
    #[account(mut, address = token_config.reserve)]
    pub reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply - validated via token_config
    #[account(mut, address = token_config.reserve_liquidity_supply)]
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: KLend collateral mint
    #[account(mut, address = token_config.collateral_mint)]
    pub reserve_collateral_mint: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: Collateral token program
    pub collateral_token_program: AccountInfo<'info>,

    /// CHECK: Instruction sysvar for KLend
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
}
