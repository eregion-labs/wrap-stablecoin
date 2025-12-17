use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub wrapped_mint: Pubkey,
    pub wrapped_mint_bump: u8,
    pub usdc_mint: Pubkey,
    pub lending_market: Pubkey,
    pub reserve: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub collateral_vault_bump: u8,
    pub vault_authority_bump: u8,
    pub total_usdc_deposited: u64,
    pub paused: bool,
}
