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
    pub wrapped_mint: Pubkey,
    pub wrapped_mint_bump: u8,
    /// Decimal precision of `wrapped_mint` (fixed at initialize).
    pub wrapped_decimals: u8,
    pub vault_authority_bump: u8,
    /// Global wrapped token liability counter (wraps − unwraps).
    pub total_stable_deposited: u64,
    pub paused: bool,
    pub wrap_public: bool,
    pub unwrap_public: bool,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_enabled: bool,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_fee_bps: u16,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_max_amount: u64,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_fee_receiver: Pubkey,
    /// Pending destination for two-step mint authority transfer. Default means no pending transfer.
    pub pending_mint_authority: Pubkey,
    /// When true, SPL mint authority has left this vault and `wrap` is permanently disabled.
    pub mint_authority_transferred: bool,
}
