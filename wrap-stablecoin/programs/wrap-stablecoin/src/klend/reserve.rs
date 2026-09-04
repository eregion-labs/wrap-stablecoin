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
/// Offset of `Reserve.liquidity.mintPubkey` — used for GPA memcmp by mint.
pub const LIQUIDITY_MINT_OFFSET: usize = 128;
/// Offset of `Reserve.liquidity.supplyVault`.
pub const LIQUIDITY_SUPPLY_OFFSET: usize = 160;
/// Offset of `Reserve.collateral.mintPubkey` (kToken).
pub const COLLATERAL_MINT_OFFSET: usize = 2560;
const MIN_RESERVE_LEN: usize = LIQUIDITY_MINT_OFFSET + 32;
const MIN_LOOKUP_LEN: usize = COLLATERAL_MINT_OFFSET + 32;

pub fn parse_reserve_market_and_mint(data: &[u8]) -> Result<(Pubkey, Pubkey)> {
    require!(data.len() >= MIN_RESERVE_LEN, ErrorCode::InvalidKlendReserve);
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
    let market_bytes: [u8; 32] = data[LENDING_MARKET_OFFSET..LENDING_MARKET_OFFSET + 32]
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidKlendReserve))?;
    let mint_bytes: [u8; 32] = data[LIQUIDITY_MINT_OFFSET..LIQUIDITY_MINT_OFFSET + 32]
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidKlendReserve))?;
    Ok((Pubkey::from(market_bytes), Pubkey::from(mint_bytes)))
}

/// Lending market, liquidity mint, liquidity supply vault, and kToken mint.
pub fn parse_reserve_lookup_fields(
    data: &[u8],
) -> Result<(Pubkey, Pubkey, Pubkey, Pubkey)> {
    let (market, mint) = parse_reserve_market_and_mint(data)?;
    require!(data.len() >= MIN_LOOKUP_LEN, ErrorCode::InvalidKlendReserve);
    let supply_bytes: [u8; 32] = data[LIQUIDITY_SUPPLY_OFFSET..LIQUIDITY_SUPPLY_OFFSET + 32]
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidKlendReserve))?;
    let collateral_bytes: [u8; 32] = data[COLLATERAL_MINT_OFFSET..COLLATERAL_MINT_OFFSET + 32]
        .try_into()
        .map_err(|_| error!(ErrorCode::InvalidKlendReserve))?;
    Ok((
        market,
        mint,
        Pubkey::from(supply_bytes),
        Pubkey::from(collateral_bytes),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn fixture_reserve_market_and_mint() {
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
        let data = base64_decode(data_b64);
        let (market, mint) = parse_reserve_market_and_mint(&data).unwrap();
        assert_eq!(
            market,
            Pubkey::from_str("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF").unwrap()
        );
        assert_eq!(
            mint,
            Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").unwrap()
        );
    }

    #[test]
    fn fixture_reserve_lookup_fields() {
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
        let data = base64_decode(data_b64);
        let (market, mint, supply, collateral) = parse_reserve_lookup_fields(&data).unwrap();
        assert_eq!(
            market,
            Pubkey::from_str("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF").unwrap()
        );
        assert_eq!(
            mint,
            Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").unwrap()
        );
        assert_eq!(
            supply,
            Pubkey::from_str("Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6").unwrap()
        );
        assert_eq!(
            collateral,
            Pubkey::from_str("B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D").unwrap()
        );
    }

    fn base64_decode(s: &str) -> Vec<u8> {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(s)
            .expect("base64")
    }
}
