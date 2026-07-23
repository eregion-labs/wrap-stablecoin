use std::sync::Arc;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::app_state::{AppState, SolanaNetwork};

pub const NETWORK_HEADER: &str = "x-solana-network";

/// Attach this deployment's primary network to the request.
///
/// - Header absent → use `primary_solana_network`.
/// - Header present → must equal primary, else 400 (no silent network switch).
pub async fn network_guard(
    State(state): State<Arc<AppState>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let primary = state.primary_solana_network;

    if let Some(raw) = req.headers().get(NETWORK_HEADER) {
        let header = raw.to_str().map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                format!("`{NETWORK_HEADER}` header is not valid utf-8"),
            )
        })?;

        let client_network: SolanaNetwork = header.parse().map_err(|e: String| {
            (
                StatusCode::BAD_REQUEST,
                format!("`{NETWORK_HEADER}` invalid: {e}"),
            )
        })?;

        if client_network != primary {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "`{NETWORK_HEADER}` `{client_network}` does not match this deployment's \
                     primary network `{primary}`"
                ),
            ));
        }
    }

    req.extensions_mut().insert(primary);
    Ok(next.run(req).await)
}
