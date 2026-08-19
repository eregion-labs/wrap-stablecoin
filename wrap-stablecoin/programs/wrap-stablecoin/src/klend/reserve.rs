//! KLend Reserve layout dependency.
//! Offsets pinned against the mainnet Reserve fixture
//! (`wrap-stablecoin/fixtures/klend/reserve.json`, dumped 2026-04-15).
//! If KLend changes its account layout, this must be updated deliberately.

use anchor_lang::prelude::*;

use crate::errors::ErrorCode;

/// `sha256("account:Reserve")[..8]` — Anchor discriminator for KLend `Reserve`.
pub const RESERVE_DISCRIMINATOR: [u8; 8] = [0x2b, 0xf2, 0xcc, 0xca, 0x1a, 0xf7, 0x3b, 0x7f];

/// `Reserve.version` observed on the pinned mainnet fixture.
pub const RESERVE_VERSION: u64 = 1;

const VERSION_OFFSET: usize = 8;
const LENDING_MARKET_OFFSET: usize = 32;
/// `Reserve.liquidity.mint_pubkey`
const LIQUIDITY_MINT_OFFSET: usize = 128;
/// `Reserve.liquidity.supply_vault`
const LIQUIDITY_SUPPLY_VAULT_OFFSET: usize = 160;
/// `Reserve.collateral.mint_pubkey` (kToken)
const COLLATERAL_MINT_OFFSET: usize = 2560;
const MIN_RESERVE_LEN: usize = COLLATERAL_MINT_OFFSET + 32;

/// The `Reserve` fields this program pins at `enable_klend`.
///
/// Read from the account rather than re-derived: KLend seeds these sub-accounts on
/// `(lending_market, liquidity_mint)`, not on the reserve, and a reserve is not
/// obliged to have been created that way. The stored fields are what KLend itself
/// enforces on every deposit/redeem, so they are the authoritative source.
pub struct ReserveView {
    pub lending_market: Pubkey,
    pub liquidity_mint: Pubkey,
    pub liquidity_supply_vault: Pubkey,
    pub collateral_mint: Pubkey,
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    let bytes: [u8; 32] = data[offset..offset + 32]
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidKlendReserve))?;
    Ok(Pubkey::from(bytes))
}

pub fn parse_reserve(data: &[u8]) -> Result<ReserveView> {
    require!(
        data.len() >= MIN_RESERVE_LEN,
        ErrorCode::InvalidKlendReserve
    );
    require!(
        data[..8] == RESERVE_DISCRIMINATOR,
        ErrorCode::InvalidKlendReserve
    );
    let version = u64::from_le_bytes(
        data[VERSION_OFFSET..VERSION_OFFSET + 8]
            .try_into()
            .map_err(|_| error!(ErrorCode::InvalidKlendReserve))?,
    );
    require!(version == RESERVE_VERSION, ErrorCode::InvalidKlendReserve);

    Ok(ReserveView {
        lending_market: read_pubkey(data, LENDING_MARKET_OFFSET)?,
        liquidity_mint: read_pubkey(data, LIQUIDITY_MINT_OFFSET)?,
        liquidity_supply_vault: read_pubkey(data, LIQUIDITY_SUPPLY_VAULT_OFFSET)?,
        collateral_mint: read_pubkey(data, COLLATERAL_MINT_OFFSET)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn fixture() -> Vec<u8> {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../fixtures/klend/reserve.json"
        );
        let raw = std::fs::read_to_string(path).expect("reserve fixture");
        let data_b64 = raw
            .split("\"data\": [")
            .nth(1)
            .and_then(|s| s.split('"').nth(1))
            .expect("base64 data field");
        base64_decode(data_b64)
    }

    #[test]
    fn fixture_reserve_fields() {
        let view = parse_reserve(&fixture()).unwrap();
        assert_eq!(
            view.lending_market,
            Pubkey::from_str("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF").unwrap()
        );
        assert_eq!(
            view.liquidity_mint,
            Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").unwrap()
        );
        assert_eq!(
            view.liquidity_supply_vault,
            Pubkey::from_str("Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6").unwrap()
        );
        assert_eq!(
            view.collateral_mint,
            Pubkey::from_str("B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D").unwrap()
        );
    }

    #[test]
    fn rejects_truncated_reserve() {
        let data = fixture();
        assert!(parse_reserve(&data[..MIN_RESERVE_LEN - 1]).is_err());
    }

    #[test]
    fn rejects_wrong_discriminator() {
        let mut data = fixture();
        data[0] ^= 0xff;
        assert!(parse_reserve(&data).is_err());
    }

    #[test]
    fn rejects_wrong_version() {
        let mut data = fixture();
        data[VERSION_OFFSET] = 9;
        assert!(parse_reserve(&data).is_err());
    }

    fn base64_decode(s: &str) -> Vec<u8> {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(s)
            .expect("base64")
    }
}
