/**
 * PDA seed prefixes for wrap_stablecoin and Kamino KLend.
 * Keep in sync with programs/wrap-stablecoin/src/pda_seeds.rs
 */

// wrap_stablecoin program accounts
export const VAULT_CONFIG_SEED = "vault_config";
export const VAULT_AUTHORITY_SEED = "vault_authority";
export const WRAPPED_MINT_SEED = "wrapped_mint";
export const ASSET_CONFIG_SEED = "token_config";
export const TOKEN_VAULT_SEED = "token_vault";
export const TREASURY_VAULT_SEED = "treasury_vault";
export const KLEND_CONFIG_SEED = "klend_config";
export const COLLATERAL_VAULT_SEED = "token_collateral_vault";
export const ALLOWLIST_SEED = "allowlist";
/** Used when the on-chain program is built with `--features flash-mint`. */
export const FLASH_LOAN_SEED = "flash_loan";

// Kamino KLend (external program)
export const KLEND_LENDING_MARKET_AUTH_SEED = "lma";
export const KLEND_RESERVE_LIQ_SUPPLY_SEED = "reserve_liq_supply";
export const KLEND_FEE_RECEIVER_SEED = "fee_receiver";
export const KLEND_RESERVE_COLL_MINT_SEED = "reserve_coll_mint";
export const KLEND_RESERVE_COLL_SUPPLY_SEED = "reserve_coll_supply";
export const KLEND_GLOBAL_CONFIG_SEED = "global_config";
