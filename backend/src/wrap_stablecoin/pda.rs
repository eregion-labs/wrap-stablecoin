use wrap_stablecoin::constants::{KLEND_PROGRAM_ID, LENDING_MARKET_AUTH_SEED};
use solana_sdk::pubkey::Pubkey;

pub fn vault_config(program_id: &Pubkey, authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault_config", authority.as_ref()], program_id)
}

pub fn vault_authority(program_id: &Pubkey, vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault_authority", vault_config.as_ref()], program_id)
}

pub fn wrapped_mint(program_id: &Pubkey, vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"wrapped_mint", vault_config.as_ref()], program_id)
}

pub fn token_config(
    program_id: &Pubkey,
    vault_config: &Pubkey,
    token_mint: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"token_config", vault_config.as_ref(), token_mint.as_ref()],
        program_id,
    )
}

pub fn lending_market_authority(klend_program: &Pubkey, lending_market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[LENDING_MARKET_AUTH_SEED, lending_market.as_ref()],
        klend_program,
    )
}

pub fn klend_program_id() -> Pubkey {
    KLEND_PROGRAM_ID
}
