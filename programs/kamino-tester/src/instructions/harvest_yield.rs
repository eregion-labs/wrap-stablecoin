use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::ErrorCode;
use crate::klend::KLEND_PROGRAM_ID;
use crate::state::VaultConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct HarvestYieldArgs {
    pub collateral_amount: u64,
}

#[derive(Accounts)]
pub struct HarvestYield<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.usdc_mint.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA authority for signing - needs mut for CPI to KLend
    #[account(
        mut,
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// CHECK: USDC mint for CPI to KLend
    #[account(address = vault_config.usdc_mint)]
    pub usdc_mint: AccountInfo<'info>,

    /// CHECK: Treasury USDC account - validated against vault_config
    #[account(mut, address = vault_config.treasury)]
    pub treasury: AccountInfo<'info>,

    /// CHECK: KLend program
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(address = vault_config.lending_market)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: KLend reserve
    #[account(mut, address = vault_config.reserve)]
    pub reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: KLend collateral mint
    #[account(mut, address = vault_config.collateral_mint)]
    pub reserve_collateral_mint: AccountInfo<'info>,

    /// CHECK: Vault's collateral token account
    #[account(mut, address = vault_config.collateral_vault)]
    pub collateral_vault: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: Collateral token program
    pub collateral_token_program: AccountInfo<'info>,

    /// CHECK: Instruction sysvar for KLend
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
}
