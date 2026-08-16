use std::str::FromStr;
use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use solana_sdk::pubkey::Pubkey;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::routes::network::RequestNetwork;
use crate::wrap_stablecoin::{
    fetch_token_holders, fetch_vault_assets, fetch_vault_meta, issue_quote, redeem_quote,
    IssueQuoteView, RedeemQuoteView, TokenHoldersView, VaultMetaView, VaultSummaryView,
};

pub type VaultAssetsResponse = VaultSummaryView;
pub type VaultMetaResponse = VaultMetaView;
pub type TokenHoldersResponse = TokenHoldersView;

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedeemQuoteQuery {
    pub amount: u64,
    #[serde(default)]
    pub asset_mint: Option<String>,
    #[serde(default)]
    pub user: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IssueQuoteQuery {
    pub amount: u64,
    #[serde(default)]
    pub asset_mint: Option<String>,
    #[serde(default)]
    pub user: Option<String>,
}

fn parse_user(user: Option<&str>) -> Result<Option<Pubkey>, (axum::http::StatusCode, String)> {
    match user {
        None => Ok(None),
        Some(s) if s.trim().is_empty() => Ok(None),
        Some(s) => Pubkey::from_str(s.trim()).map(Some).map_err(|e| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                format!("invalid user: {e}"),
            )
        }),
    }
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

/// Largest wrapped-token accounts (RPC top 20). Keys are token-account addresses, not wallet owners.
#[utoipa::path(
    get,
    path = "/v1/vault/token-holders",
    responses((status = 200, body = TokenHoldersResponse), (status = 400))
)]
pub async fn token_holders(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
) -> Result<Json<TokenHoldersResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let holders = fetch_token_holders(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(holders))
}

/// Deterministic redeem quote from current on-chain policy and vault liquidity.
#[utoipa::path(
    get,
    path = "/v1/quote/redeem",
    params(
        ("amount" = u64, Query, description = "Wrapped token atoms to burn"),
        ("assetMint" = Option<String>, Query, description = "Collateral mint; defaults to server DEFAULT_ASSET_MINT"),
        ("user" = Option<String>, Query, description = "Wallet to evaluate allowlist access"),
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
    let user = parse_user(query.user.as_deref())?;
    let quote = redeem_quote(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &asset_mint,
        query.amount,
        user.as_ref(),
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(quote))
}

/// Deterministic issue quote (mint haircut) from current on-chain policy.
#[utoipa::path(
    get,
    path = "/v1/quote/issue",
    params(
        ("amount" = u64, Query, description = "Underlying collateral atoms to wrap"),
        ("assetMint" = Option<String>, Query, description = "Collateral mint; defaults to server DEFAULT_ASSET_MINT"),
        ("user" = Option<String>, Query, description = "Wallet to evaluate allowlist access"),
    ),
    responses((status = 200, body = IssueQuoteView), (status = 400))
)]
pub async fn issue_quote_handler(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Query(query): Query<IssueQuoteQuery>,
) -> Result<Json<IssueQuoteView>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let asset_mint = ctx
        .resolve_asset_mint(query.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let user = parse_user(query.user.as_deref())?;
    let quote = issue_quote(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &asset_mint,
        query.amount,
        user.as_ref(),
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(quote))
}
