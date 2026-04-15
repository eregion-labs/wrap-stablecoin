use std::str::FromStr;
use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::jupiter;
use crate::wrap_stablecoin::{
    build_versioned_tx, decode_versioned_tx_b64, ensure_tx_targets_program,
    instructions_from_versioned_tx, unsigned_unwrap_tx_bytes, unsigned_wrap_tx_bytes,
};

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IssueRequest {
    /// Fee payer / signer (user wallet base58).
    pub user: String,
    /// Base token amount to wrap (smallest units).
    pub amount: u64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedeemRequest {
    pub user: String,
    pub amount: u64,
    /// Minimum base token out (unwrap slippage floor).
    pub min_out_amount: u64,
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
        amount: u64,
    },
    Unwrap {
        amount: u64,
        min_out_amount: u64,
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

/// Decode `raw` and confirm at least one instruction targets our wStable program.
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
    Json(body): Json<IssueRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let user = Pubkey::from_str(&body.user).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid user: {e}"),
        )
    })?;
    let raw = unsigned_wrap_tx_bytes(
        state.rpc.as_ref(),
        &state.program_id,
        &state.vault_authority_seed,
        &user,
        body.amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    verify_tx_bytes(&raw, &state.program_id)?;
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
    Json(body): Json<RedeemRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let user = Pubkey::from_str(&body.user).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid user: {e}"),
        )
    })?;
    let raw = unsigned_unwrap_tx_bytes(
        state.rpc.as_ref(),
        &state.program_id,
        &state.vault_authority_seed,
        &user,
        body.amount,
        body.min_out_amount,
    )
    .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    verify_tx_bytes(&raw, &state.program_id)?;
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
    Json(body): Json<PreviewRequest>,
) -> Result<Json<PreviewResponse>, (axum::http::StatusCode, String)> {
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(body.transaction_b64.trim())
        .map_err(|e| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                format!("base64: {e}"),
            )
        })?;
    let vtx: VersionedTransaction =
        bincode::deserialize(&raw).map_err(|e| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                format!("tx decode: {e}"),
            )
        })?;
    ensure_tx_targets_program(&vtx, &state.program_id)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let sim = state
        .rpc
        .simulate_transaction(&vtx)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
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
    Json(body): Json<ComposeRequest>,
) -> Result<Json<TxResponse>, (axum::http::StatusCode, String)> {
    let user = Pubkey::from_str(&body.user).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("invalid user: {e}"),
        )
    })?;
    let user_str = body.user.clone();

    if body.steps.is_empty() {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "steps empty".into(),
        ));
    }

    if body.steps.len() == 1 {
        let raw = match &body.steps[0] {
            ComposeStep::Wrap { amount } => unsigned_wrap_tx_bytes(
                state.rpc.as_ref(),
                &state.program_id,
                &state.vault_authority_seed,
                &user,
                *amount,
            ),
            ComposeStep::Unwrap {
                amount,
                min_out_amount,
            } => unsigned_unwrap_tx_bytes(
                state.rpc.as_ref(),
                &state.program_id,
                &state.vault_authority_seed,
                &user,
                *amount,
                *min_out_amount,
            ),
            ComposeStep::JupiterSwap { .. } => {
                return Err((
                    axum::http::StatusCode::BAD_REQUEST,
                    "JupiterSwap alone is not supported; pair with wrap or unwrap".into(),
                ));
            }
        }
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
        verify_tx_bytes(&raw, &state.program_id)?;
        return Ok(Json(TxResponse {
            transaction_b64: b64_encode_tx(&raw),
        }));
    }

    if body.steps.len() != 2 {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "only 1 or 2 steps supported".into(),
        ));
    }

    let vtx = match (&body.steps[0], &body.steps[1]) {
        (ComposeStep::JupiterSwap { quote }, ComposeStep::Wrap { amount }) => {
            let swap_b64 = jupiter::fetch_swap_transaction_b64(state.as_ref(), quote, &user_str)
                .await
                .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
            let jup = decode_versioned_tx_b64(&swap_b64)
                .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
            let wrap_raw = unsigned_wrap_tx_bytes(
                state.rpc.as_ref(),
                &state.program_id,
                &state.vault_authority_seed,
                &user,
                *amount,
            )
            .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
            let wrap_vtx: VersionedTransaction = bincode::deserialize(&wrap_raw).map_err(|e| {
                (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;
            let mut ixs =
                instructions_from_versioned_tx(state.rpc.as_ref(), &jup).map_err(|e| {
                    (axum::http::StatusCode::BAD_REQUEST, e.to_string())
                })?;
            ixs.extend(
                instructions_from_versioned_tx(state.rpc.as_ref(), &wrap_vtx).map_err(|e| {
                    (axum::http::StatusCode::BAD_REQUEST, e.to_string())
                })?,
            );
            build_versioned_tx(state.rpc.as_ref(), &user, ixs, None).map_err(|e| {
                (axum::http::StatusCode::BAD_REQUEST, e.to_string())
            })?
        }
        (
            ComposeStep::Unwrap {
                amount,
                min_out_amount,
            },
            ComposeStep::JupiterSwap { quote },
        ) => {
            let unwrap_raw = unsigned_unwrap_tx_bytes(
                state.rpc.as_ref(),
                &state.program_id,
                &state.vault_authority_seed,
                &user,
                *amount,
                *min_out_amount,
            )
            .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
            let unwrap_vtx: VersionedTransaction =
                bincode::deserialize(&unwrap_raw).map_err(|e| {
                    (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
                })?;
            let swap_b64 = jupiter::fetch_swap_transaction_b64(state.as_ref(), quote, &user_str)
                .await
                .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
            let jup = decode_versioned_tx_b64(&swap_b64)
                .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
            let mut ixs =
                instructions_from_versioned_tx(state.rpc.as_ref(), &unwrap_vtx).map_err(|e| {
                    (axum::http::StatusCode::BAD_REQUEST, e.to_string())
                })?;
            ixs.extend(
                instructions_from_versioned_tx(state.rpc.as_ref(), &jup).map_err(|e| {
                    (axum::http::StatusCode::BAD_REQUEST, e.to_string())
                })?,
            );
            build_versioned_tx(state.rpc.as_ref(), &user, ixs, None).map_err(|e| {
                (axum::http::StatusCode::BAD_REQUEST, e.to_string())
            })?
        }
        _ => {
            return Err((
                axum::http::StatusCode::BAD_REQUEST,
                "unsupported sequence: use [jupiter_swap, wrap] or [unwrap, jupiter_swap]".into(),
            ));
        }
    };

    ensure_tx_targets_program(&vtx, &state.program_id)
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;
    let raw = bincode::serialize(&vtx).map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            e.to_string(),
        )
    })?;
    Ok(Json(TxResponse {
        transaction_b64: b64_encode_tx(&raw),
    }))
}
