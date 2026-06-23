use solana_sdk::pubkey::Pubkey;
use wrap_stablecoin::constants::KLEND_PROGRAM_ID;
use wrap_stablecoin::pda_seeds::{
    ALLOWLIST_SEED, ASSET_CONFIG_SEED, COLLATERAL_VAULT_SEED, KLEND_CONFIG_SEED,
    KLEND_LENDING_MARKET_AUTH_SEED, TREASURY_VAULT_SEED, TOKEN_VAULT_SEED, VAULT_AUTHORITY_SEED,
    VAULT_CONFIG_SEED, WRAPPED_MINT_SEED,
};

/// Seed for optional on-chain `flash-mint` feature (not compiled in shipped program).
const FLASH_LOAN_SEED: &[u8] = b"flash_loan";

pub fn vault_config(program_id: &Pubkey, authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[VAULT_CONFIG_SEED, authority.as_ref()], program_id)
}

pub fn vault_authority(program_id: &Pubkey, vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[VAULT_AUTHORITY_SEED, vault_config.as_ref()], program_id)
}

pub fn wrapped_mint(program_id: &Pubkey, vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[WRAPPED_MINT_SEED, vault_config.as_ref()], program_id)
}

/// Asset registry PDA (historical seed name: `token_config`).
pub fn asset_config(
    program_id: &Pubkey,
    vault_config: &Pubkey,
    token_mint: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            ASSET_CONFIG_SEED,
            vault_config.as_ref(),
            token_mint.as_ref(),
        ],
        program_id,
    )
}

pub fn token_config(
    program_id: &Pubkey,
    vault_config: &Pubkey,
    token_mint: &Pubkey,
) -> (Pubkey, u8) {
    asset_config(program_id, vault_config, token_mint)
}

pub fn klend_config(program_id: &Pubkey, asset_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[KLEND_CONFIG_SEED, asset_config.as_ref()], program_id)
}

pub fn treasury_vault(program_id: &Pubkey, asset_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TREASURY_VAULT_SEED, asset_config.as_ref()], program_id)
}

pub fn token_vault(program_id: &Pubkey, asset_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TOKEN_VAULT_SEED, asset_config.as_ref()], program_id)
}

pub fn collateral_vault(program_id: &Pubkey, asset_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[COLLATERAL_VAULT_SEED, asset_config.as_ref()], program_id)
}

pub fn allowlist(program_id: &Pubkey, vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ALLOWLIST_SEED, vault_config.as_ref()], program_id)
}

/// Flash-loan state PDA for the experimental `flash-mint` program feature.
/// Not exposed via the HTTP API; reserved for future market-making integrations.
pub fn flash_loan_state(
    program_id: &Pubkey,
    borrower: &Pubkey,
    vault_config: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            FLASH_LOAN_SEED,
            borrower.as_ref(),
            vault_config.as_ref(),
        ],
        program_id,
    )
}

pub fn lending_market_authority(klend_program: &Pubkey, lending_market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[KLEND_LENDING_MARKET_AUTH_SEED, lending_market.as_ref()],
        klend_program,
    )
}

pub fn klend_program_id() -> Pubkey {
    KLEND_PROGRAM_ID
}
