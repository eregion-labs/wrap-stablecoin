use axum::http::StatusCode;

/// Map an error on a local-only `/v1/admin/*` route: the full anyhow context chain goes
/// to the client so operators see the root cause.
pub fn admin_error(e: anyhow::Error) -> (StatusCode, String) {
    (StatusCode::BAD_REQUEST, format!("{e:#}"))
}

/// Map an error on a public route: only the outermost context goes to the client, because
/// inner causes can carry the private RPC URL. The full chain is logged server-side.
pub fn public_error(e: anyhow::Error) -> (StatusCode, String) {
    tracing::warn!("request failed: {e:#}");
    (StatusCode::BAD_REQUEST, e.to_string())
}
