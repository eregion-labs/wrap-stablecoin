use std::sync::Arc;

use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::app_state::AppState;
use crate::config::PublicClientConfig;

/// Public bootstrap config for frontends. Unauthenticated; no `x-solana-network`.
#[utoipa::path(
    get,
    path = "/v1/client-config",
    responses((status = 200, description = "Immutable public client config", body = PublicClientConfig))
)]
pub async fn client_config_handler(State(state): State<Arc<AppState>>) -> Response {
    let config = state.public_client_config.as_ref();
    let etag = match config.etag() {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("etag: {e}"),
            )
                .into_response();
        }
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=60, stale-while-revalidate=300"),
    );
    if let Ok(v) = HeaderValue::from_str(&etag) {
        headers.insert(header::ETAG, v);
    }

    (headers, Json(config)).into_response()
}
