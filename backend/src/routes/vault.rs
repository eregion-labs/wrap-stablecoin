use std::str::FromStr;
use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::Serialize;
use solana_sdk::pubkey::Pubkey;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::wrap_stablecoin::fetch_vault_assets;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultAssetsResponse {
    pub assets: Vec<crate::wrap_stablecoin::VaultAssetView>,
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

pub fn resolve_asset_mint(state: &AppState, asset_mint: Option<&str>) -> Result<Pubkey, String> {
    match asset_mint {
        Some(m) => Pubkey::from_str(m).map_err(|e| format!("invalid assetMint: {e}")),
        None => Pubkey::from_str(&state.default_asset_mint)
            .map_err(|e| format!("invalid DEFAULT_ASSET_MINT: {e}")),
    }
}
