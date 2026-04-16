use std::sync::Arc;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::app_state::{AppState, SolanaNetwork};

pub const NETWORK_HEADER: &str = "x-solana-network";

/// Reject requests whose `x-solana-network` header does not match the
/// cluster this backend is wired to. Prevents handing a client a
/// transaction built against devnet accounts when they intend to submit
/// to mainnet (and vice versa).
pub async fn network_guard(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let header = req
        .headers()
        .get(NETWORK_HEADER)
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                format!(
                    "missing `{NETWORK_HEADER}` header; expected `{}`",
                    state.network
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

    if client_network != state.network {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "network mismatch: client=`{client_network}`, server=`{}`",
                state.network
            ),
        ));
    }

    Ok(next.run(req).await)
}
