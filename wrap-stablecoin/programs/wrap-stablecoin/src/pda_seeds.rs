//! PDA seed prefixes for `wrap_stablecoin` and Kamino KLend CPI accounts.
//!
//! Each constant is the first seed element; full paths are documented inline.

// =============================================================================
// wrap_stablecoin program accounts
// =============================================================================

/// Vault singleton. Seeds: `["vault_config", authority]`.
pub const VAULT_CONFIG_SEED: &[u8] = b"vault_config";

/// Token-authority PDA for vault-owned ATAs. Seeds: `["vault_authority", vault_config]`.
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

/// wrapped token mint. Seeds: `["wrapped_mint", vault_config]`.
pub const WRAPPED_MINT_SEED: &[u8] = b"wrapped_mint";

/// Per-collateral registry (`AssetConfig`). Seeds: `["token_config", vault_config, underlying_mint]`.
/// Historical seed name retained for account compatibility.
pub const ASSET_CONFIG_SEED: &[u8] = b"token_config";

/// Alias for [`ASSET_CONFIG_SEED`].
pub const TOKEN_CONFIG_SEED: &[u8] = ASSET_CONFIG_SEED;

/// Free backing vault for an asset. Seeds: `["token_vault", asset_config]`.
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";

/// Protocol yield vault (not wrapped token backing). Seeds: `["treasury_vault", asset_config]`.
pub const TREASURY_VAULT_SEED: &[u8] = b"treasury_vault";

/// Optional Kamino integration config. Seeds: `["klend_config", asset_config]`.
pub const KLEND_CONFIG_SEED: &[u8] = b"klend_config";

/// Kamino kToken vault for an asset. Seeds: `["token_collateral_vault", asset_config]`.
pub const COLLATERAL_VAULT_SEED: &[u8] = b"token_collateral_vault";

/// Wrap/unwrap gate when not public. Seeds: `["allowlist", vault_config]`.
pub const ALLOWLIST_SEED: &[u8] = b"allowlist";

/// Transient flash-mint state (`flash-mint` feature only). Seeds: `["flash_loan", borrower, vault_config]`.
#[cfg(feature = "flash-mint")]
pub const FLASH_LOAN_SEED: &[u8] = b"flash_loan";

// =============================================================================
// Kamino KLend program (external)
// =============================================================================

/// Lending market authority. Seeds: `["lma", lending_market]` under KLend program id.
pub const KLEND_LENDING_MARKET_AUTH_SEED: &[u8] = b"lma";

/// Reserve liquidity supply. Seeds: `["reserve_liq_supply", reserve]`.
pub const KLEND_RESERVE_LIQ_SUPPLY_SEED: &[u8] = b"reserve_liq_supply";

/// Reserve fee receiver. Seeds: `["fee_receiver", reserve]`.
pub const KLEND_FEE_RECEIVER_SEED: &[u8] = b"fee_receiver";

/// Reserve collateral mint (kToken). Seeds: `["reserve_coll_mint", reserve]`.
pub const KLEND_RESERVE_COLL_MINT_SEED: &[u8] = b"reserve_coll_mint";

/// Reserve collateral supply. Seeds: `["reserve_coll_supply", reserve]`.
pub const KLEND_RESERVE_COLL_SUPPLY_SEED: &[u8] = b"reserve_coll_supply";

/// KLend global config. Seeds: `["global_config"]`.
pub const KLEND_GLOBAL_CONFIG_SEED: &[u8] = b"global_config";
