use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Vault is currently paused")]
    VaultPaused,

    #[msg("Insufficient balance for operation")]
    InsufficientBalance,

    #[msg("No yield available to harvest")]
    NoYieldAvailable,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Flash mint feature is disabled")]
    FlashMintDisabled,

    #[msg("Missing flash_mint_end instruction in transaction")]
    MissingFlashMintEnd,

    #[msg("Invalid flash loan state")]
    InvalidFlashLoan,

    #[msg("Insufficient balance to repay flash loan")]
    InsufficientRepayment,

    #[msg("Flash mint fee exceeds maximum")]
    InvalidFlashMintFee,
}
