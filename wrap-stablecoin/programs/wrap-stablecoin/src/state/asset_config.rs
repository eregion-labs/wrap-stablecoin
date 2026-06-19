use anchor_lang::prelude::*;

/// Per-collateral reserve configuration. PDA seeds: `["token_config", vault_config, underlying_mint]`.
#[account]
#[derive(InitSpace)]
pub struct AssetConfig {
    pub bump: u8,
    pub vault_config: Pubkey,
    /// Underlying SPL mint (USDC, USDT, wBTC, …); precision stored at registration.
    pub token_mint: Pubkey,
    /// `underlying_mint.decimals` snapshot (1..=18).
    pub token_decimals: u8,
    /// Protocol yield vault (PDA). Not part of wStable backing.
    pub treasury_vault: Pubkey,
    pub treasury_vault_bump: u8,
    pub token_vault: Pubkey,
    pub token_vault_bump: u8,
    /// Cumulative underlying deposited via `wrap` (underlying token atoms).
    pub total_deposits: u64,
    /// Cumulative wStable minted from this pool (wrapped token atoms).
    pub total_wrapped_minted: u64,
    /// Cumulative wStable burned via `unwrap` against this pool (wrapped token atoms).
    pub total_redemptions: u64,
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
    /// Bps discount on wStable minted per unit underlying (200 = mint 0.98 wStable per 1 USDT).
    pub mint_haircut_bps: u16,
    /// Bps discount on underlying paid per unit wStable burned.
    pub redemption_haircut_bps: u16,
    /// Max outstanding wStable liability (`total_wrapped_minted - total_redemptions`). 0 = unlimited.
    pub mint_cap: u64,
    /// Alias exposure cap in wStable atoms for governance dashboards. 0 = unlimited.
    pub exposure_cap: u64,
    /// Policy hint: target free-vault liquidity for redemption UX.
    pub min_liquidity_target: u64,
    pub asset_status: AssetStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum AssetStatus {
    Active,
    Paused,
    MintOnly,
    RedeemOnly,
    Deprecated,
}

impl AssetConfig {
    /// Outstanding wStable liability backed by this pool.
    pub fn net_liability(&self) -> Result<u64> {
        self.total_wrapped_minted
            .checked_sub(self.total_redemptions)
            .ok_or(error!(crate::errors::ErrorCode::MathOverflow))
    }

    pub fn mint_allowed(&self) -> bool {
        self.mint_enabled
            && matches!(
                self.asset_status,
                AssetStatus::Active | AssetStatus::MintOnly
            )
    }

    pub fn redeem_allowed(&self) -> bool {
        self.redeem_enabled
            && matches!(
                self.asset_status,
                AssetStatus::Active | AssetStatus::RedeemOnly
            )
    }
}

/// Backward-compatible alias for clients generated against the old name.
pub type TokenConfig = AssetConfig;
