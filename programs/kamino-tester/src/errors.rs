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
}
