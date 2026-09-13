use axum::http::StatusCode;

/// Run synchronous work (the blocking `RpcClient`) on tokio's blocking pool so slow RPC
/// calls never stall the async worker threads that serve every route.
///
/// Returns the closure's value unchanged; a panic or cancellation of the task maps to 500.
pub async fn run_blocking<T, F>(f: F) -> Result<T, (StatusCode, String)>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
