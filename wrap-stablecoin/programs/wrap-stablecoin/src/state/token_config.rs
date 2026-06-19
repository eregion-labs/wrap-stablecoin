use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    pub bump: u8,
    pub vault_config: Pubkey,
    pub token_mint: Pubkey,
    pub token_decimals: u8,
    pub reserve: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub collateral_vault_bump: u8,
    pub token_vault: Pubkey,
    pub token_vault_bump: u8,
    pub total_deposited: u64,
    pub is_base_token: bool,
    pub enabled: bool,
    pub reserve_liquidity_supply: Pubkey,
    /// USDC-denominated liability sitting in KLend. `deposit_to_klend` increments by the amount
    /// deposited; `withdraw_from_klend` decrements (saturating) by the liquidity actually received
    /// back. Used by `harvest_yield` to cap harvests above user backing.
    pub total_liquidity_in_klend: u64,
}
