//! Discover existing KLend reserves for a liquidity mint.

use anyhow::Result;
use serde::Deserialize;
use serde::Serialize;
use solana_account_decoder_client_types::UiAccountEncoding;
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig};
use solana_client::rpc_filter::{Memcmp, RpcFilterType};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use tracing::warn;
use utoipa::ToSchema;
use wrap_stablecoin::klend::{
    parse_reserve_lookup_fields, LIQUIDITY_MINT_OFFSET, RESERVE_DISCRIMINATOR,
};

use super::pda::klend_program_id;

const TOKEN_PROGRAM: Pubkey =
    solana_sdk::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM: Pubkey =
    solana_sdk::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// Kamino Main Market (mainnet / localnet clone).
pub const KAMINO_MAIN_MARKET: &str = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
/// Kamino primary market on official Solana devnet (may have zero reserves).
pub const KAMINO_DEVNET_MARKET: &str = "ARVAgHAZiNGCbZ8Cb4BitwZoNQ8eBWsk7ZeinPgmNjgi";
const KAMINO_API: &str = "https://api.kamino.finance/kamino-market/reserves/account-data";
const MAINNET_USDC_RESERVE: &str = "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KlendReserveMatch {
    pub lending_market: String,
    pub reserve: String,
    pub reserve_liquidity_supply: String,
    pub collateral_mint: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KlendReserveLookup {
    pub asset_mint: String,
    pub mint_exists: bool,
    pub reserves: Vec<KlendReserveMatch>,
}

#[derive(Debug, Deserialize)]
struct KaminoMarketPayload {
    #[allow(dead_code)]
    market: String,
    reserves: Vec<KaminoReservePayload>,
}

#[derive(Debug, Deserialize)]
struct KaminoReservePayload {
    pubkey: String,
    data: String,
}

pub fn lookup_klend_reserves_for_mint(
    rpc: &RpcClient,
    mint: &Pubkey,
    kamino_markets: &[Pubkey],
) -> Result<KlendReserveLookup> {
    let mint_exists = match rpc.get_account(mint) {
        Ok(acc) => acc.owner == TOKEN_PROGRAM || acc.owner == TOKEN_2022_PROGRAM,
        Err(_) => false,
    };
    if !mint_exists {
        return Ok(KlendReserveLookup {
            asset_mint: mint.to_string(),
            mint_exists: false,
            reserves: vec![],
        });
    }

    let mut reserves = match gpa_reserves(rpc, mint) {
        Ok(found) => found,
        // Keep serving the API/known-reserve fallbacks, but never fail silently:
        // a swallowed error here reads as "no Kamino reserve" in the admin console.
        Err(e) => {
            warn!("klend reserve gpa failed for mint {mint}: {e:#}");
            vec![]
        }
    };
    for market in kamino_markets {
        for found in kamino_api_reserves(market, mint) {
            if !reserve_exists_here(rpc, &found) {
                continue;
            }
            if reserves.iter().any(|r| r.reserve == found.reserve) {
                continue;
            }
            reserves.push(found);
        }
    }
    if let Some(found) = known_usdc_reserve(rpc, mint) {
        if !reserves.iter().any(|r| r.reserve == found.reserve) {
            reserves.push(found);
        }
    }

    reserves.sort_by(|a, b| {
        let a_main = a.lending_market == KAMINO_MAIN_MARKET;
        let b_main = b.lending_market == KAMINO_MAIN_MARKET;
        b_main.cmp(&a_main).then_with(|| a.reserve.cmp(&b.reserve))
    });

    Ok(KlendReserveLookup {
        asset_mint: mint.to_string(),
        mint_exists: true,
        reserves,
    })
}

fn gpa_reserves(rpc: &RpcClient, mint: &Pubkey) -> Result<Vec<KlendReserveMatch>> {
    let program = klend_program_id();
    let accounts = rpc.get_program_accounts_with_config(
        &program,
        RpcProgramAccountsConfig {
            filters: Some(vec![
                RpcFilterType::Memcmp(Memcmp::new_base58_encoded(0, &RESERVE_DISCRIMINATOR)),
                RpcFilterType::Memcmp(Memcmp::new_base58_encoded(
                    LIQUIDITY_MINT_OFFSET,
                    mint.as_ref(),
                )),
            ]),
            account_config: RpcAccountInfoConfig {
                // Must be explicit: with `None` the RPC defaults to base58, which refuses
                // to encode accounts over 128 bytes, so the whole call errors out.
                encoding: Some(UiAccountEncoding::Base64),
                data_slice: None,
                commitment: Some(CommitmentConfig::confirmed()),
                min_context_slot: None,
            },
            with_context: Some(false),
            sort_results: Some(false),
        },
    )?;
    Ok(accounts
        .into_iter()
        .filter_map(|(pubkey, account)| match_account(mint, pubkey, &account.data))
        .collect())
}

fn kamino_api_reserves(market: &Pubkey, mint: &Pubkey) -> Vec<KlendReserveMatch> {
    let url = format!("{KAMINO_API}?markets={market}");
    let Ok(resp) = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(12))
        .call()
    else {
        return vec![];
    };
    let Ok(payloads) = resp.into_json::<Vec<KaminoMarketPayload>>() else {
        return vec![];
    };
    let mut out = Vec::new();
    for payload in payloads {
        for row in payload.reserves {
            let Ok(data) = base64::Engine::decode(
                &base64::engine::general_purpose::STANDARD,
                row.data.as_bytes(),
            ) else {
                continue;
            };
            let Ok(reserve) = row.pubkey.parse::<Pubkey>() else {
                continue;
            };
            if let Some(found) = match_account(mint, reserve, &data) {
                out.push(found);
            }
        }
    }
    out
}

fn known_usdc_reserve(rpc: &RpcClient, mint: &Pubkey) -> Option<KlendReserveMatch> {
    let reserve: Pubkey = MAINNET_USDC_RESERVE.parse().ok()?;
    let acc = rpc.get_account(&reserve).ok()?;
    match_account(mint, reserve, &acc.data)
}

fn reserve_exists_here(rpc: &RpcClient, found: &KlendReserveMatch) -> bool {
    let Ok(reserve) = found.reserve.parse::<Pubkey>() else {
        return false;
    };
    rpc.get_account(&reserve).is_ok()
}

fn match_account(mint: &Pubkey, reserve: Pubkey, data: &[u8]) -> Option<KlendReserveMatch> {
    let (market, parsed_mint, supply, collateral) = parse_reserve_lookup_fields(data).ok()?;
    if parsed_mint != *mint {
        return None;
    }
    Some(KlendReserveMatch {
        lending_market: market.to_string(),
        reserve: reserve.to_string(),
        reserve_liquidity_supply: supply.to_string(),
        collateral_mint: collateral.to_string(),
    })
}
