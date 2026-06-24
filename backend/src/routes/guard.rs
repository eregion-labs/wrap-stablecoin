use std::sync::Arc;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::app_state::{AppState, SolanaNetwork};

pub const NETWORK_HEADER: &str = "x-solana-network";

/// Resolve the client-selected cluster and attach it to the request.
/// The backend serves every configured network from one process; the frontend
/// picks the cluster via `x-solana-network`.
pub async fn network_guard(
    State(state): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let header = req
        .headers()
        .get(NETWORK_HEADER)
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                format!(
                    "missing `{NETWORK_HEADER}` header; expected one of: {}",
                    state.configured_networks().join(", ")
                ),
            )
        })?
        .to_str()
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                format!("`{NETWORK_HEADER}` header is not valid utf-8"),
            )
        })?
        .to_string();

    let client_network: SolanaNetwork = header.parse().map_err(|e: String| {
        (
            StatusCode::BAD_REQUEST,
            format!("`{NETWORK_HEADER}` invalid: {e}"),
        )
    })?;

    state
        .require_network(client_network)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    req.extensions_mut().insert(client_network);
    Ok(next.run(req).await)
}
