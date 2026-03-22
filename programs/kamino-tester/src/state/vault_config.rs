use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub wrapped_mint: Pubkey,
    pub wrapped_mint_bump: u8,
    pub vault_authority_bump: u8,
    pub lending_market: Pubkey,
    pub usdc_mint: Pubkey,
    pub total_stable_deposited: u64,
    pub registered_tokens: u8,
    pub paused: bool,
    pub flash_mint_enabled: bool,
    pub flash_mint_fee_bps: u16,
}
