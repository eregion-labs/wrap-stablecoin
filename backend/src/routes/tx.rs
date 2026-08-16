use std::str::FromStr;
use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use utoipa::ToSchema;

use crate::app_state::{AppState, NetworkContext};
use crate::routes::network::RequestNetwork;
use crate::wrap_stablecoin::{ensure_tx_targets_program, unsigned_unwrap_tx_bytes, unsigned_wrap_tx_bytes};

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IssueRequest {
    /// Fee payer / signer (user wallet base58).
    pub user: String,
    /// Collateral mint to wrap (defaults to `DEFAULT_ASSET_MINT` when omitted).
    #[serde(default)]
    pub asset_mint: Option<String>,
    /// Base token amount to wrap (smallest units).
    pub amount: u64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedeemRequest {
    pub user: String,
    /// Redemption asset mint (defaults to `DEFAULT_ASSET_MINT` when omitted).
    #[serde(default)]
    pub asset_mint: Option<String>,
    pub amount: u64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TxResponse {
    /// `bincode` serialized `VersionedTransaction` (standard wallet decode), base64.
    pub transaction_b64: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRequest {
    pub transaction_b64: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    pub err: Option<String>,
    pub logs: Option<Vec<String>>,
    pub units_consumed: Option<u64>,
}

fn b64_encode_tx(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn bad_request(msg: String) -> (axum::http::StatusCode, String) {
    (axum::http::StatusCode::BAD_REQUEST, msg)
}

fn require_ctx<'a>(
    state: &'a AppState,
    network: RequestNetwork,
) -> Result<&'a NetworkContext, (axum::http::StatusCode, String)> {
    state.require_network(network.0).map_err(bad_request)
}

/// Decode `raw` and confirm at least one instruction targets the wrap-stablecoin program.
/// Returns `(status, body)` suitable for propagating as an axum error tuple.
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

/// Build unsigned **wrap** (issue) transaction.
#[utoipa::path(
    post,
    path = "/v1/tx/issue",
    request_body = IssueRequest,
    responses((status = 200, body = TxResponse), (status = 400, description = "Bad input / RPC error"))
)]
pub async fn issue_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<IssueRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = require_ctx(state.as_ref(), RequestNetwork(network))?;
    let user = Pubkey::from_str(&body.user).map_err(|e| bad_request(format!("invalid user: {e}")))?;
    let asset_mint = ctx
        .resolve_asset_mint(body.asset_mint.as_deref())
        .map_err(bad_request)?;
    let raw = unsigned_wrap_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &user,
        &asset_mint,
        body.amount,
    )
    .map_err(|e| bad_request(e.to_string()))?;
    verify_tx_bytes(&raw, &ctx.program_id)?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}

/// Build unsigned **unwrap** (redeem) transaction.
#[utoipa::path(
    post,
    path = "/v1/tx/redeem",
    request_body = RedeemRequest,
    responses((status = 200, body = TxResponse), (status = 400, description = "Bad input / RPC error"))
)]
pub async fn redeem_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<RedeemRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = require_ctx(state.as_ref(), RequestNetwork(network))?;
    let user = Pubkey::from_str(&body.user).map_err(|e| bad_request(format!("invalid user: {e}")))?;
    let asset_mint = ctx
        .resolve_asset_mint(body.asset_mint.as_deref())
        .map_err(bad_request)?;
    let raw = unsigned_unwrap_tx_bytes(
        ctx.rpc.as_ref(),
        &ctx.program_id,
        &ctx.vault_authority_seed,
        &user,
        &asset_mint,
        body.amount,
    )
    .map_err(|e| bad_request(e.to_string()))?;
    verify_tx_bytes(&raw, &ctx.program_id)?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}

/// Simulate a serialized transaction (unsigned ok).
#[utoipa::path(
    post,
    path = "/v1/tx/preview",
    request_body = PreviewRequest,
    responses((status = 200, body = PreviewResponse))
)]
pub async fn preview_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<PreviewRequest>,
) -> Result<Json<PreviewResponse>, (axum::http::StatusCode, String)> {
    let ctx = require_ctx(state.as_ref(), RequestNetwork(network))?;
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(body.transaction_b64.trim())
        .map_err(|e| bad_request(format!("base64: {e}")))?;
    let vtx: VersionedTransaction = bincode::deserialize(&raw).map_err(|e| bad_request(format!("tx decode: {e}")))?;
    ensure_tx_targets_program(&vtx, &ctx.program_id).map_err(|e| bad_request(e.to_string()))?;
    let sim = ctx
        .rpc
        .simulate_transaction(&vtx)
        .map_err(|e| bad_request(e.to_string()))?;
    let err = sim.value.err.map(|e| format!("{e:?}"));
    let logs = sim.value.logs;
    let units_consumed = sim.value.units_consumed;
    Ok(Json(PreviewResponse {
        err,
        logs,
        units_consumed,
    }))
}
