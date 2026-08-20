//! Cross-origin policy for the browser clients.
//!
//! The API is called from two browser apps on their own origins (public app, admin console),
//! so CORS cannot simply be off — but it must not be open either: `/v1/admin/*` signs with the
//! vault admin key, and a permissive policy lets any page a browser visits reach a backend
//! bound to localhost or a private network.
//!
//! Origins are derived from the URLs already configured for those apps, so a normal deployment
//! needs no extra config. `CORS_ALLOWED_ORIGINS` adds extras (preview deployments, a second
//! console). When nothing is configured the allowlist is empty, which permits same-origin
//! requests only — correct for a deployment serving API and app behind one origin.

use anyhow::{bail, Context, Result};
use axum::http::HeaderValue;

use crate::config::env::env_opt;
use crate::config::AppEnvironment;

/// Dev-server origins allowed automatically when `APP_ENV=local`.
const LOCAL_DEV_ORIGINS: &[&str] = &[
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
];

/// Build the exact-match origin allowlist. Invalid entries fail at startup rather than
/// surfacing later as opaque browser CORS errors.
pub fn resolve_allowed_origins(
    environment: AppEnvironment,
    public_app_url: Option<&str>,
    admin_dashboard_url: Option<&str>,
) -> Result<Vec<HeaderValue>> {
    let mut origins: Vec<String> = Vec::new();

    if let Some(raw) = env_opt("CORS_ALLOWED_ORIGINS") {
        for entry in raw.split(',') {
            let entry = entry.trim();
            if entry.is_empty() {
                continue;
            }
            origins.push(origin_of(entry).with_context(|| {
                format!("CORS_ALLOWED_ORIGINS entry `{entry}` is not a valid origin")
            })?);
        }
    }

    for (url, key) in [
        (public_app_url, "PUBLIC_APP_URL"),
        (admin_dashboard_url, "ADMIN_DASHBOARD_URL"),
    ] {
        if let Some(url) = url {
            origins.push(
                origin_of(url).with_context(|| format!("{key} is not a valid absolute URL"))?,
            );
        }
    }

    if environment == AppEnvironment::Local {
        origins.extend(LOCAL_DEV_ORIGINS.iter().map(|s| s.to_string()));
    }

    origins.sort();
    origins.dedup();

    origins
        .into_iter()
        .map(|o| {
            HeaderValue::from_str(&o)
                .with_context(|| format!("origin `{o}` is not a valid header value"))
        })
        .collect()
}

/// Reduce an absolute URL to its origin (`scheme://host[:port]`), dropping any path, query,
/// or fragment. An `Origin` header never carries those, so comparison must not either.
fn origin_of(url: &str) -> Result<String> {
    let trimmed = url.trim().trim_end_matches('/');
    let Some((scheme, rest)) = trimmed.split_once("://") else {
        bail!("expected an absolute URL with a scheme, got `{url}`");
    };
    let scheme_lower = scheme.to_ascii_lowercase();
    if scheme_lower != "http" && scheme_lower != "https" {
        bail!("origin scheme must be http or https, got `{scheme}`");
    }
    // Authority ends at the first '/', '?' or '#'.
    let authority = rest
        .split(['/', '?', '#'])
        .next()
        .filter(|a| !a.is_empty())
        .with_context(|| format!("URL `{url}` has no host"))?;
    if authority.contains('@') {
        bail!("origin must not contain credentials: `{url}`");
    }
    Ok(format!(
        "{scheme_lower}://{}",
        authority.to_ascii_lowercase()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: Vec<HeaderValue>) -> Vec<String> {
        values
            .iter()
            .map(|v| v.to_str().unwrap().to_string())
            .collect()
    }

    #[test]
    fn strips_path_query_and_fragment() {
        assert_eq!(
            origin_of("https://app.example.com/a/b").unwrap(),
            "https://app.example.com"
        );
        assert_eq!(
            origin_of("https://app.example.com/?x=1").unwrap(),
            "https://app.example.com"
        );
        assert_eq!(
            origin_of("https://app.example.com/#f").unwrap(),
            "https://app.example.com"
        );
    }

    #[test]
    fn keeps_port_and_normalises_case() {
        assert_eq!(
            origin_of("http://LocalHost:3002/").unwrap(),
            "http://localhost:3002"
        );
        assert_eq!(
            origin_of("HTTPS://App.Example.COM").unwrap(),
            "https://app.example.com"
        );
    }

    #[test]
    fn rejects_malformed_or_unsafe_urls() {
        assert!(origin_of("app.example.com").is_err()); // no scheme
        assert!(origin_of("ftp://example.com").is_err()); // wrong scheme
        assert!(origin_of("https://").is_err()); // no host
        assert!(origin_of("https://user:pw@example.com").is_err()); // credentials
    }

    #[test]
    fn non_local_env_without_config_is_empty() {
        // Same-origin only: no cross-origin request is permitted by default.
        let origins = resolve_allowed_origins(AppEnvironment::Production, None, None).unwrap();
        assert!(origins.is_empty());
    }

    #[test]
    fn local_env_includes_dev_servers() {
        let origins = strings(resolve_allowed_origins(AppEnvironment::Local, None, None).unwrap());
        assert!(origins.contains(&"http://localhost:3000".to_string()));
        assert!(origins.contains(&"http://localhost:3002".to_string()));
    }

    #[test]
    fn app_urls_become_origins_and_dedupe() {
        let origins = strings(
            resolve_allowed_origins(
                AppEnvironment::Production,
                Some("https://app.example.com/home"),
                Some("https://app.example.com/admin"),
            )
            .unwrap(),
        );
        assert_eq!(origins, vec!["https://app.example.com".to_string()]);
    }

    #[test]
    fn invalid_app_url_fails_startup() {
        assert!(
            resolve_allowed_origins(AppEnvironment::Production, Some("not-a-url"), None).is_err()
        );
    }
}
