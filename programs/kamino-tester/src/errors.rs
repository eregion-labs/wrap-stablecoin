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

    #[msg("Wrap accepts base token only")]
    BaseTokenOnly,

    #[msg("Insufficient liquidity for redemption")]
    InsufficientLiquidity,

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

    #[msg("Token is disabled")]
    TokenDisabled,

    #[msg("Token has existing deposits, cannot remove")]
    TokenHasDeposits,

    #[msg("Cannot remove base token")]
    CannotRemoveBaseToken,

    #[msg("Token already registered")]
    TokenAlreadyRegistered,

    #[msg("Maximum tokens registered")]
    MaxTokensReached,

    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Swap failed")]
    SwapFailed,

    #[msg("Token not found")]
    TokenNotFound,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Not allowed to wrap")]
    NotAllowedToWrap,

    #[msg("Not allowed to unwrap")]
    NotAllowedToUnwrap,

    #[msg("Allowlist full")]
    AllowlistFull,

    #[msg("Pubkey not in allowlist")]
    NotInAllowlist,

    #[msg("Pubkey already in allowlist")]
    AllowlistDuplicate,
}
