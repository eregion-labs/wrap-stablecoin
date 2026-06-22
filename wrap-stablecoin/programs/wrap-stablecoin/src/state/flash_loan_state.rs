#![cfg(feature = "flash-mint")]

use anchor_lang::prelude::*;

/// Transient state for an in-flight flash mint. PDA seeds: `["flash_loan", borrower, vault_config]`.
#[account]
#[derive(InitSpace)]
pub struct FlashLoanState {
    pub bump: u8,
    pub borrower: Pubkey,
    pub vault_config: Pubkey,
    pub amount: u64,
    pub fee: u64,
}
