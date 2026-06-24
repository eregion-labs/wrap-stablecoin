use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::routes::network::RequestNetwork;
use crate::wrap_stablecoin::{fetch_vault_assets, fetch_vault_meta, redeem_quote, RedeemQuoteView, VaultMetaView, VaultSummaryView};

pub type VaultAssetsResponse = VaultSummaryView;
pub type VaultMetaResponse = VaultMetaView;

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedeemQuoteQuery {
    pub amount: u64,
    #[serde(default)]
    pub asset_mint: Option<String>,
}

/// Per-asset reserve liquidity and policy flags for redemption UX.
#[utoipa::path(
    get,
    path = "/v1/vault/assets",
    responses((status = 200, body = VaultAssetsResponse), (status = 400))
)]
pub async fn vault_assets(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<VaultAssetsResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let summary = fetch_vault_assets(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(summary))
}

/// Vault admin pubkey and cluster metadata for frontend gating.
#[utoipa::path(
    get,
    path = "/v1/vault/meta",
    responses((status = 200, body = VaultMetaResponse), (status = 400))
)]
pub async fn vault_meta(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<VaultMetaResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let meta = fetch_vault_meta(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(meta))
}

/// Deterministic redeem quote from current on-chain policy and vault liquidity.
#[utoipa::path(
    get,
    path = "/v1/quote/redeem",
    params(
        ("amount" = u64, Query, description = "wStable atoms to burn"),
        ("assetMint" = Option<String>, Query, description = "Collateral mint; defaults to server DEFAULT_ASSET_MINT"),
    ),
    responses((status = 200, body = RedeemQuoteView), (status = 400))
)]
pub async fn redeem_quote_handler(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Query(query): Query<RedeemQuoteQuery>,
) -> Result<Json<RedeemQuoteView>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let asset_mint = ctx
        .resolve_asset_mint(query.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let quote = redeem_quote(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &asset_mint,
        query.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(quote))
}
