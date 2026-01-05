use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FlashLoanState {
    pub bump: u8,
    pub borrower: Pubkey,
    pub vault_config: Pubkey,
    pub amount: u64,
    pub fee: u64,
}
