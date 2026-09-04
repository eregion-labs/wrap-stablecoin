use std::str::FromStr;
use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use solana_sdk::pubkey::Pubkey;
use utoipa::ToSchema;

use crate::app_state::{AppState, SolanaNetwork};
use crate::config::env::env_opt;
use crate::routes::network::RequestNetwork;
use crate::wrap_stablecoin::{
    lookup_klend_reserves_for_mint, KlendReserveLookup, KAMINO_DEVNET_MARKET, KAMINO_MAIN_MARKET,
};

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KlendReserveQuery {
    pub asset_mint: String,
}

fn default_kamino_markets(network: SolanaNetwork) -> Vec<Pubkey> {
    let mut markets = Vec::new();
    if let Some(raw) = env_opt("KLEND_LENDING_MARKETS") {
        for part in raw.split(',') {
            if let Ok(pk) = Pubkey::from_str(part.trim()) {
                markets.push(pk);
            }
        }
    }
    let fallback = match network {
        SolanaNetwork::Devnet => KAMINO_DEVNET_MARKET,
        SolanaNetwork::Mainnet | SolanaNetwork::Localnet => KAMINO_MAIN_MARKET,
    };
    if let Ok(pk) = Pubkey::from_str(fallback) {
        if !markets.iter().any(|m| m == &pk) {
            markets.push(pk);
        }
    }
    markets
}

/// Look up existing Kamino/KLend reserves for a liquidity mint on this cluster.
#[utoipa::path(
    get,
    path = "/v1/admin/klend-reserve",
    params(
        ("assetMint" = String, Query, description = "Underlying token mint to match against KLend reserves")
    ),
    responses((status = 200, body = KlendReserveLookup), (status = 400))
)]
pub async fn klend_reserve(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Query(query): Query<KlendReserveQuery>,
) -> Result<Json<KlendReserveLookup>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let mint = Pubkey::from_str(query.asset_mint.trim()).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid assetMint: {e}"),
        )
    })?;
    let markets = default_kamino_markets(network);
    let rpc = ctx.rpc.clone();
    let lookup = tokio::task::spawn_blocking(move || {
        lookup_klend_reserves_for_mint(&rpc, &mint, &markets)
    })
    .await
    .map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            e.to_string(),
        )
    })?
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, format!("{e:#}")))?;
    Ok(Json(lookup))
}
