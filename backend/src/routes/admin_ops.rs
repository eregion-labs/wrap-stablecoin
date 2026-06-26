use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signer;
use std::str::FromStr;
use utoipa::ToSchema;
use wrap_stablecoin::UpdateAssetPolicyArgs;

use crate::app_state::AppState;
use crate::routes::network::RequestNetwork;
use crate::tx_submit::sign_and_send_versioned_tx;
use crate::wrap_stablecoin::{
    parse_asset_status, unsigned_add_asset_tx_bytes, unsigned_unwrap_tx_bytes,
    unsigned_update_asset_policy_tx_bytes, unsigned_wrap_tx_bytes,
};

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResponse {
    pub signature: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterAssetRequest {
    pub asset_mint: String,
    #[serde(default = "default_true")]
    pub mint_enabled: bool,
    #[serde(default = "default_true")]
    pub redeem_enabled: bool,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetPolicyBody {
    pub asset_mint: String,
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
    pub mint_haircut_bps: u16,
    pub redemption_haircut_bps: u16,
    pub mint_cap: u64,
    pub exposure_cap: u64,
    pub min_liquidity_target: u64,
    pub asset_status: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdminMintRequest {
    pub amount: u64,
    pub asset_mint: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdminRedeemRequest {
    pub amount: u64,
    pub asset_mint: Option<String>,
}

fn default_true() -> bool {
    true
}

fn require_admin_keypair(
    state: &AppState,
    network: crate::app_state::SolanaNetwork,
) -> Result<(Arc<solana_sdk::signature::Keypair>, &crate::app_state::NetworkContext), (axum::http::StatusCode, String)>
{
    let ctx = state
        .require_network(network)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;
    let kp = ctx.admin_keypair.clone().ok_or_else(|| {
        (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            format!(
                "admin keypair not configured for `{network}` — set {}_ADMIN_KEYPAIR_PATH",
                network.env_prefix()
            ),
        )
    })?;
    Ok((kp, ctx))
}

fn parse_mint(s: &str, field: &str) -> Result<Pubkey, (axum::http::StatusCode, String)> {
    Pubkey::from_str(s).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid {field}: {e}"),
        )
    })
}

/// Register collateral using the server-held vault admin keypair.
#[utoipa::path(
    post,
    path = "/v1/admin/register-asset",
    request_body = RegisterAssetRequest,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn register_asset(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<RegisterAssetRequest>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = parse_mint(&body.asset_mint, "assetMint")?;

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

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Update on-chain asset policy using the server-held vault admin keypair.
#[utoipa::path(
    post,
    path = "/v1/admin/update-asset-policy",
    request_body = UpdateAssetPolicyBody,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn update_asset_policy(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<UpdateAssetPolicyBody>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = parse_mint(&body.asset_mint, "assetMint")?;
    let asset_status = parse_asset_status(&body.asset_status)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

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

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Wrap collateral from the admin wallet into the wrapped token (issue).
#[utoipa::path(
    post,
    path = "/v1/admin/mint",
    request_body = AdminMintRequest,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn admin_mint(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AdminMintRequest>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = ctx
        .resolve_asset_mint(body.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;

    let raw = unsigned_wrap_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        body.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}

/// Burn wrapped token from the admin wallet and receive underlying (redeem).
#[utoipa::path(
    post,
    path = "/v1/admin/redeem",
    request_body = AdminRedeemRequest,
    responses((status = 200, body = ExecuteResponse), (status = 400), (status = 503))
)]
pub async fn admin_redeem(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<AdminRedeemRequest>,
) -> Result<Json<ExecuteResponse>, (axum::http::StatusCode, String)> {
    let (kp, ctx) = require_admin_keypair(&state, network)?;
    let admin = kp.pubkey();
    let asset_mint = ctx
        .resolve_asset_mint(body.asset_mint.as_deref())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e))?;

    let raw = unsigned_unwrap_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &admin,
        &asset_mint,
        body.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let sig = sign_and_send_versioned_tx(ctx.rpc.as_ref(), &raw, &[kp.as_ref()])
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(ExecuteResponse {
        signature: sig.to_string(),
    }))
}
