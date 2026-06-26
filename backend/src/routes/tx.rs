use std::str::FromStr;
use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use utoipa::ToSchema;

use crate::app_state::{AppState, NetworkContext};
use crate::jupiter;
use crate::routes::network::RequestNetwork;
use crate::wrap_stablecoin::{
    build_versioned_tx, decode_versioned_tx_b64, ensure_tx_targets_program,
    instructions_from_versioned_tx, unsigned_unwrap_tx_bytes, unsigned_wrap_tx_bytes,
};

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

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ComposeStep {
    JupiterSwap {
        /// Full JSON object from Jupiter GET `/v6/quote` (used as `quoteResponse` in POST `/swap`).
        quote: Value,
    },
    Wrap {
        #[serde(default)]
        asset_mint: Option<String>,
        amount: u64,
    },
    Unwrap {
        #[serde(default)]
        asset_mint: Option<String>,
        amount: u64,
    },
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComposeRequest {
    pub user: String,
    pub steps: Vec<ComposeStep>,
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

/// Compose ordered steps: `jupiter_swap` + `wrap`, or `unwrap` + `jupiter_swap`, or single wrap/unwrap.
#[utoipa::path(
    post,
    path = "/v1/tx/compose",
    request_body = ComposeRequest,
    responses((status = 200, body = TxResponse), (status = 400))
)]
pub async fn compose_tx(
    State(state): State<Arc<AppState>>,
    RequestNetwork(network): RequestNetwork,
    Json(body): Json<ComposeRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let ctx = require_ctx(state.as_ref(), RequestNetwork(network))?;
    let user = Pubkey::from_str(&body.user).map_err(|e| bad_request(format!("invalid user: {e}")))?;
    let user_str = body.user.clone();

    if body.steps.is_empty() {
        return Err(bad_request("steps empty".into()));
    }

    if body.steps.len() == 1 {
        let raw = match &body.steps[0] {
            ComposeStep::Wrap { asset_mint, amount } => {
                let mint = ctx
                    .resolve_asset_mint(asset_mint.as_deref())
                    .map_err(bad_request)?;
                unsigned_wrap_tx_bytes(
                    ctx.rpc.as_ref(),
                    &ctx.program_id,
                    &ctx.vault_authority_seed,
                    &user,
                    &mint,
                    *amount,
                )
            }
            ComposeStep::Unwrap { asset_mint, amount } => {
                let mint = ctx
                    .resolve_asset_mint(asset_mint.as_deref())
                    .map_err(bad_request)?;
                unsigned_unwrap_tx_bytes(
                    ctx.rpc.as_ref(),
                    &ctx.program_id,
                    &ctx.vault_authority_seed,
                    &user,
                    &mint,
                    *amount,
                )
            }
            ComposeStep::JupiterSwap { .. } => {
                return Err(bad_request(
                    "JupiterSwap alone is not supported; pair with wrap or unwrap".into(),
                ));
            }
        }
        .map_err(|e| bad_request(e.to_string()))?;
        verify_tx_bytes(&raw, &ctx.program_id)?;
        return Ok(Json(TxResponse {
            transaction_b64: b64_encode_tx(&raw),
        }));
    }

    if body.steps.len() != 2 {
        return Err(bad_request("only 1 or 2 steps supported".into()));
    }

    let vtx = match (&body.steps[0], &body.steps[1]) {
        (ComposeStep::JupiterSwap { quote }, ComposeStep::Wrap { asset_mint, amount }) => {
            let mint = ctx
                .resolve_asset_mint(asset_mint.as_deref())
                .map_err(bad_request)?;
            let swap_b64 = jupiter::fetch_swap_transaction_b64(state.as_ref(), quote, &user_str)
                .await
                .map_err(|e| bad_request(e.to_string()))?;
            let jup = decode_versioned_tx_b64(&swap_b64).map_err(|e| bad_request(e.to_string()))?;
            let wrap_raw = unsigned_wrap_tx_bytes(
                ctx.rpc.as_ref(),
                &ctx.program_id,
                &ctx.vault_authority_seed,
                &user,
                &mint,
                *amount,
            )
            .map_err(|e| bad_request(e.to_string()))?;
            let wrap_vtx: VersionedTransaction = bincode::deserialize(&wrap_raw).map_err(|e| {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    format!("wrap tx decode: {e}"),
                )
            })?;
            let mut ixs = instructions_from_versioned_tx(ctx.rpc.as_ref(), &jup)
                .map_err(|e| bad_request(e.to_string()))?;
            ixs.extend(
                instructions_from_versioned_tx(ctx.rpc.as_ref(), &wrap_vtx)
                    .map_err(|e| bad_request(e.to_string()))?,
            );
            build_versioned_tx(ctx.rpc.as_ref(), &user, ixs, None)
                .map_err(|e| bad_request(e.to_string()))?
        }
        (
            ComposeStep::Unwrap { asset_mint, amount },
            ComposeStep::JupiterSwap { quote },
        ) => {
            let mint = ctx
                .resolve_asset_mint(asset_mint.as_deref())
                .map_err(bad_request)?;
            let unwrap_raw = unsigned_unwrap_tx_bytes(
                ctx.rpc.as_ref(),
                &ctx.program_id,
                &ctx.vault_authority_seed,
                &user,
                &mint,
                *amount,
            )
            .map_err(|e| bad_request(e.to_string()))?;
            let unwrap_vtx: VersionedTransaction = bincode::deserialize(&unwrap_raw).map_err(|e| {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    format!("unwrap tx decode: {e}"),
                )
            })?;
            let swap_b64 = jupiter::fetch_swap_transaction_b64(state.as_ref(), quote, &user_str)
                .await
                .map_err(|e| bad_request(e.to_string()))?;
            let jup = decode_versioned_tx_b64(&swap_b64).map_err(|e| bad_request(e.to_string()))?;
            let mut ixs = instructions_from_versioned_tx(ctx.rpc.as_ref(), &unwrap_vtx)
                .map_err(|e| bad_request(e.to_string()))?;
            ixs.extend(
                instructions_from_versioned_tx(ctx.rpc.as_ref(), &jup)
                    .map_err(|e| bad_request(e.to_string()))?,
            );
            build_versioned_tx(ctx.rpc.as_ref(), &user, ixs, None)
                .map_err(|e| bad_request(e.to_string()))?
        }
        _ => {
            return Err(bad_request(
                "unsupported sequence: use [jupiter_swap, wrap] or [unwrap, jupiter_swap]".into(),
            ));
        }
    };

    ensure_tx_targets_program(&vtx, &ctx.program_id).map_err(|e| bad_request(e.to_string()))?;
    let raw = bincode::serialize(&vtx)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}
