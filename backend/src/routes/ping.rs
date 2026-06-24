use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::app_state::AppState;

#[derive(Serialize, utoipa::ToSchema)]
pub struct PingResponse {
    pub ok: bool,
    /// Clusters configured on this API instance (`x-solana-network` values).
    pub networks: Vec<String>,
}

/// Liveness check.
#[utoipa::path(
    get,
    path = "/ping",
    responses((status = 200, description = "OK", body = PingResponse))
)]
pub async fn ping_handler(State(state): State<Arc<AppState>>) -> Json<PingResponse> {
    Json(PingResponse {
        ok: true,
        networks: state
            .configured_networks()
            .into_iter()
            .map(str::to_string)
            .collect(),
    })
}
