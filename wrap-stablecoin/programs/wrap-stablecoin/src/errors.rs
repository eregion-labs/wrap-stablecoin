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

    #[msg("Insufficient liquidity for redemption")]
    InsufficientLiquidity,

    #[msg("Redemption exceeds pool liability obligation")]
    InsufficientLiability,

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

    #[msg("Harvest amount exceeds available yield")]
    ExceedsHarvestableYield,

    #[msg("Sweep amount exceeds home vault surplus")]
    ExceedsHomeSurplus,

    #[msg("Flash mint amount exceeds configured maximum")]
    FlashMintAmountExceeded,

    #[msg("No pending authority transfer")]
    NoPendingTransfer,

    #[msg("Invalid treasury address")]
    InvalidTreasury,

    #[msg("Reserve account not owned by KLend program")]
    InvalidReserveOwner,

    #[msg("Token account data invalid or unexpected owner")]
    InvalidTokenAccountData,

    #[msg("Flash mint introspection scan exceeded bound")]
    FlashMintScanLimit,

    #[msg("Harvest would leave insufficient backing for tracked liability")]
    HarvestLeavesUnderbacked,

    #[msg("Harvest redeem produced no collateral movement")]
    HarvestRedeemedNothing,

    #[msg("Flash mint fee receiver is not configured")]
    FlashMintFeeReceiverUnset,

    #[msg("Minting is disabled for this asset")]
    MintDisabled,

    #[msg("Redemption is disabled for this asset")]
    RedeemDisabled,

    #[msg("Mint cap exceeded for this asset")]
    MintCapExceeded,

    #[msg("Exposure cap exceeded for this asset")]
    ExposureCapExceeded,

    #[msg("Asset registry is full")]
    AssetRegistryFull,

    #[msg("Asset already registered")]
    AssetAlreadyRegistered,

    #[msg("Asset not registered in vault")]
    AssetNotRegistered,

    #[msg("Wrapped token cannot back itself as collateral")]
    ReflexiveCollateralForbidden,

    #[msg("Invalid mint metadata")]
    InvalidMetadata,

    #[msg("Mint metadata account address mismatch")]
    InvalidMetadataAccount,

    #[msg("Mint metadata already initialized")]
    MetadataAlreadyInitialized,

    #[msg("KLend is not enabled for this asset")]
    KlendNotEnabled,

    #[msg("Invalid haircut bps")]
    InvalidHaircut,

    #[msg("Token decimals must be between 1 and 18")]
    InvalidDecimals,

    #[msg("Mint authority has been transferred; wrapping is permanently disabled")]
    MintAuthorityTransferred,

    #[msg("No pending mint authority transfer")]
    NoPendingMintAuthorityTransfer,

    #[msg("Mint authority transfer already completed")]
    MintAuthorityAlreadyTransferred,

    #[msg("Remaining asset config accounts do not match registered assets")]
    InvalidAssetConfigAccounts,

    #[msg("KLend Reserve account layout, discriminator, or version is invalid")]
    InvalidKlendReserve,

    #[msg("KLend Reserve lending_market does not match the supplied market")]
    KlendReserveMarketMismatch,

    #[msg("KLend Reserve liquidity mint does not match the registered asset")]
    KlendReserveMintMismatch,

    #[msg("Kamino deposit moved no liquidity from the vault")]
    ZeroLiquidityDeposited,

    #[msg("Collateral mint must be classic SPL Token or Token-2022 with no extensions")]
    UnsupportedTokenExtension,

    // Append new variants here only. Anchor assigns codes by declaration order, so
    // inserting mid-enum renumbers every later variant and breaks deployed clients.
    #[msg("KLend Reserve liquidity supply vault does not match the supplied account")]
    KlendReserveSupplyMismatch,

    #[msg("KLend Reserve collateral mint does not match the supplied account")]
    KlendReserveCollateralMintMismatch,
}
