use std::sync::Arc;

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::app_state::{AppState, SolanaNetwork};

pub const NETWORK_HEADER: &str = "x-solana-network";

/// Require a valid `Authorization: Bearer <ADMIN_API_TOKEN>` on server-signing admin routes.
///
/// These routes sign with the vault admin keypair, so reaching one is equivalent to holding
/// the admin key. Fails closed when no token is configured; `AppState::from_env` additionally
/// refuses to boot with an admin keypair and no token.
///
/// Not applied to `/v1/tx/admin/*`, which only builds unsigned transactions — those carry no
/// privilege, since the chain rejects anything the real admin has not signed.
pub async fn admin_auth_guard(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let Some(expected) = state.admin_api_token.as_deref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "admin API is disabled: ADMIN_API_TOKEN is not configured".to_string(),
        ));
    };

    let presented = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(bearer_token)
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                "missing or malformed `Authorization: Bearer <token>` header".to_string(),
            )
        })?;

    if !expected.matches(presented) {
        return Err((
            StatusCode::UNAUTHORIZED,
            "invalid admin bearer token".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

/// Extract the credential from an `Authorization` value, matching the scheme case-insensitively
/// per RFC 7235. Returns `None` for any other scheme or an empty credential.
fn bearer_token(header: &str) -> Option<&str> {
    let (scheme, token) = header.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    let token = token.trim();
    (!token.is_empty()).then_some(token)
}

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

#[cfg(test)]
mod tests {
    use super::bearer_token;
    use crate::app_state::{AdminApiToken, MIN_ADMIN_API_TOKEN_LEN};

    const TOKEN: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn parses_bearer_credential() {
        assert_eq!(bearer_token("Bearer abc123"), Some("abc123"));
    }

    #[test]
    fn scheme_match_is_case_insensitive() {
        assert_eq!(bearer_token("bearer abc123"), Some("abc123"));
        assert_eq!(bearer_token("BEARER abc123"), Some("abc123"));
    }

    #[test]
    fn rejects_other_schemes_and_bare_tokens() {
        assert_eq!(bearer_token("Basic abc123"), None);
        assert_eq!(bearer_token("abc123"), None);
        assert_eq!(bearer_token("Bearer "), None);
        assert_eq!(bearer_token(""), None);
    }

    #[test]
    fn accepts_only_the_configured_token() {
        let token = AdminApiToken::new(TOKEN).unwrap();
        assert!(token.matches(TOKEN));
        assert!(!token.matches("0123456789abcdef0123456789abcdeF"));
        assert!(!token.matches(""));
        // A correct prefix must not pass — guards against prefix-comparison bugs.
        assert!(!token.matches(&TOKEN[..MIN_ADMIN_API_TOKEN_LEN - 1]));
        // Nor a superstring of the real token.
        assert!(!token.matches(&format!("{TOKEN}extra")));
    }

    #[test]
    fn rejects_short_tokens_at_construction() {
        assert!(AdminApiToken::new("short").is_err());
        assert!(AdminApiToken::new(&"a".repeat(MIN_ADMIN_API_TOKEN_LEN - 1)).is_err());
        assert!(AdminApiToken::new(&"a".repeat(MIN_ADMIN_API_TOKEN_LEN)).is_ok());
    }
}
