use anchor_lang::prelude::*;

pub const MAX_REGISTERED_ASSETS: usize = 8;

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
    /// Number of entries in `registered_assets`.
    pub asset_count: u8,
    /// Mints with an `AssetConfig` PDA under this vault.
    pub registered_assets: [Pubkey; MAX_REGISTERED_ASSETS],
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
}

impl VaultConfig {
    pub fn register_asset(&mut self, mint: Pubkey) -> Result<()> {
        require!(
            (self.asset_count as usize) < MAX_REGISTERED_ASSETS,
            crate::errors::ErrorCode::AssetRegistryFull
        );
        require!(
            !self.has_asset(&mint),
            crate::errors::ErrorCode::AssetAlreadyRegistered
        );
        let idx = self.asset_count as usize;
        self.registered_assets[idx] = mint;
        self.asset_count = self
            .asset_count
            .checked_add(1)
            .ok_or(crate::errors::ErrorCode::MathOverflow)?;
        Ok(())
    }

    pub fn has_asset(&self, mint: &Pubkey) -> bool {
        self.registered_assets[..self.asset_count as usize]
            .iter()
            .any(|m| m == mint)
    }
}
