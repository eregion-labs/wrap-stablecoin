use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub bump: u8,
    /// Immutable creator key used in PDA seeds. Never changes after init.
    pub authority: Pubkey,
    /// Mutable operational admin. Can be transferred via two-step process.
    pub admin: Pubkey,
    /// Pending admin for two-step authority transfer. Default means no pending transfer.
    pub pending_admin: Pubkey,
    pub treasury: Pubkey,
    pub wrapped_mint: Pubkey,
    pub wrapped_mint_bump: u8,
    pub vault_authority_bump: u8,
    pub lending_market: Pubkey,
    pub base_mint: Pubkey,
    pub total_stable_deposited: u64,
    pub registered_tokens: u8,
    pub paused: bool,
    pub flash_mint_enabled: bool,
    pub flash_mint_fee_bps: u16,
    /// Maximum amount for a single flash mint. 0 means no limit.
    pub flash_mint_max_amount: u64,
}
