use std::str::FromStr;
use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use utoipa::ToSchema;
use wrap_stablecoin::UpdateAssetPolicyArgs;

use crate::app_state::AppState;
use crate::routes::network::RequestNetwork;
use crate::routes::tx::TxResponse;
use crate::wrap_stablecoin::{
    ensure_tx_targets_program, parse_asset_status, unsigned_add_asset_tx_bytes,
    unsigned_update_asset_policy_tx_bytes,
};

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddAssetRequest {
    /// Vault admin signer (must match on-chain `vault_config.admin`).
    pub admin: String,
    pub asset_mint: String,
    #[serde(default = "default_true")]
    pub mint_enabled: bool,
    #[serde(default = "default_true")]
    pub redeem_enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetPolicyRequest {
    pub admin: String,
    pub asset_mint: String,
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
    pub mint_haircut_bps: u16,
    pub redemption_haircut_bps: u16,
    pub mint_cap: u64,
    pub exposure_cap: u64,
    pub min_liquidity_target: u64,
    /// One of: active, paused, mint_only, redeem_only, deprecated
    pub asset_status: String,
}

fn b64_encode_tx(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn verify_tx_bytes(
    raw: &[u8],
    program_id: &Pubkey,
) -> Result<(), (axum::http::StatusCode, String)> {
    let vtx: VersionedTransaction = bincode::deserialize(raw).map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("tx decode: {e}"),
        )
    })?;
    ensure_tx_targets_program(&vtx, program_id)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))
}

/// Build unsigned **add_asset** transaction (register collateral).
#[utoipa::path(
    post,
    path = "/v1/tx/admin/add-asset",
    request_body = AddAssetRequest,
    responses((status = 200, body = TxResponse), (status = 400))
)]
pub async fn add_asset_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AddAssetRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let admin = Pubkey::from_str(&body.admin).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid admin: {e}"),
        )
    })?;
    let asset_mint = Pubkey::from_str(&body.asset_mint).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid assetMint: {e}"),
        )
    })?;
    let raw = unsigned_add_asset_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        body.mint_enabled,
        body.redeem_enabled,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    verify_tx_bytes(&raw, &ctx.program_id)?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}

/// Build unsigned **update_asset_policy** transaction.
#[utoipa::path(
    post,
    path = "/v1/tx/admin/update-asset-policy",
    request_body = UpdateAssetPolicyRequest,
    responses((status = 200, body = TxResponse), (status = 400))
)]
pub async fn update_asset_policy_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<UpdateAssetPolicyRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let admin = Pubkey::from_str(&body.admin).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid admin: {e}"),
        )
    })?;
    let asset_mint = Pubkey::from_str(&body.asset_mint).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid assetMint: {e}"),
        )
    })?;
    let asset_status = parse_asset_status(&body.asset_status).map_err(|e| {
        (axum::http::StatusCode::BAD_REQUEST, e.to_string())
    })?;
    let args = UpdateAssetPolicyArgs {
        mint_enabled: body.mint_enabled,
        redeem_enabled: body.redeem_enabled,
        mint_haircut_bps: body.mint_haircut_bps,
        redemption_haircut_bps: body.redemption_haircut_bps,
        mint_cap: body.mint_cap,
        exposure_cap: body.exposure_cap,
        min_liquidity_target: body.min_liquidity_target,
        asset_status,
    };
    let raw = unsigned_update_asset_policy_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        &args,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    verify_tx_bytes(&raw, &ctx.program_id)?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}
