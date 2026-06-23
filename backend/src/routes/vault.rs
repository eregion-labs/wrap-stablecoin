use std::str::FromStr;
use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::wrap_stablecoin::{fetch_vault_assets, redeem_quote, RedeemQuoteView, VaultAssetView};

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultAssetsResponse {
    pub assets: Vec<VaultAssetView>,
}

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
) -> Result<Json<VaultAssetsResponse>, (axum::http::StatusCode, String)> {
    let assets = fetch_vault_assets(
        state.rpc.as_ref(),
        &state.program_id,
        &state.vault_authority_seed,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(VaultAssetsResponse { assets }))
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
    Query(query): Query<RedeemQuoteQuery>,
) -> Result<Json<RedeemQuoteView>, (axum::http::StatusCode, String)> {
    let asset_mint = resolve_asset_mint(state.as_ref(), query.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let quote = redeem_quote(
        state.rpc.as_ref(),
        &state.program_id,
        &state.vault_authority_seed,
        &asset_mint,
        query.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(quote))
}

pub fn resolve_asset_mint(state: &AppState, asset_mint: Option<&str>) -> Result<Pubkey, String> {
    match asset_mint {
        Some(m) => Pubkey::from_str(m).map_err(|e| format!("invalid assetMint: {e}")),
        None => Pubkey::from_str(&state.default_asset_mint)
            .map_err(|e| format!("invalid DEFAULT_ASSET_MINT: {e}")),
    }
}
