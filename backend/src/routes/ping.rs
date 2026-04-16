use axum::Json;
use serde::Serialize;

#[derive(Serialize, utoipa::ToSchema)]
pub struct PingResponse {
    pub ok: bool,
}

/// Liveness check.
#[utoipa::path(
    get,
    path = "/ping",
    responses((status = 200, description = "OK", body = PingResponse))
)]
pub async fn ping_handler() -> Json<PingResponse> {
    Json(PingResponse { ok: true })
}
