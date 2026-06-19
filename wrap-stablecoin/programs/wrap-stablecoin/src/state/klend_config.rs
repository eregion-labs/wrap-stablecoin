use anchor_lang::prelude::*;

/// Kamino KLend integration for a registered asset. PDA seeds: `["klend_config", asset_config]`.
#[account]
#[derive(InitSpace)]
pub struct KLendConfig {
    pub bump: u8,
    pub asset_config: Pubkey,
    pub lending_market: Pubkey,
    pub reserve: Pubkey,
    pub reserve_liquidity_supply: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub collateral_vault_bump: u8,
    /// USDC-denominated principal deployed to KLend for this asset.
    pub total_liquidity_in_klend: u64,
}
