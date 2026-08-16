use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::app_state::AppState;

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PingResponse {
    pub ok: bool,
    /// Primary Solana cluster for this deployment.
    pub network: String,
    pub deployment_id: String,
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
        network: state.primary_solana_network.as_header().to_string(),
        deployment_id: state.public_client_config.deployment_id.clone(),
    })
}
