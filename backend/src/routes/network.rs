use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;

use crate::app_state::SolanaNetwork;

/// Cluster resolved from `x-solana-network` by [`super::guard::network_guard`].
#[derive(Debug, Clone, Copy)]
pub struct RequestNetwork(pub SolanaNetwork);

impl<S> FromRequestParts<S> for RequestNetwork
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<SolanaNetwork>()
            .copied()
            .map(RequestNetwork)
            .ok_or((
                StatusCode::INTERNAL_SERVER_ERROR,
                "network not resolved by middleware".into(),
            ))
    }
}
