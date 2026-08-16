//! Boot-time env loading: `.env` then optional AWS Secrets Manager fill-missing-only merge.
//!
//! Merge rule: process env / `.env` always wins; secret only fills missing or empty keys.
//! If `SECRET_NAME` is unset or fetch fails, warn and continue (offline local dev works).

use tracing::{info, warn};

use super::env::{env_opt, merge_fill_missing};

/// Load `backend/.env` into process env (no-op if missing). Call before tracing init
/// so `RUST_LOG` from `.env` is visible.
pub fn load_dotenv() {
    let _ = dotenvy::dotenv();
}

/// If `SECRET_NAME` is set, fetch flat JSON from AWS Secrets Manager and fill missing keys.
/// Call after tracing is initialized so warnings are visible.
pub fn merge_optional_secret() {
    let Some(secret_name) = env_opt("SECRET_NAME") else {
        return;
    };

    match fetch_secret_json(&secret_name) {
        Ok(json) => match serde_json::from_str::<serde_json::Value>(&json) {
            Ok(serde_json::Value::Object(map)) => {
                let filled = merge_fill_missing(&map);
                info!(
                    secret_name = %secret_name,
                    filled,
                    "merged AWS Secrets Manager values (fill-missing-only)"
                );
            }
            Ok(_) => warn!(
                secret_name = %secret_name,
                "secret payload is not a flat JSON object; skipping merge"
            ),
            Err(e) => warn!(
                secret_name = %secret_name,
                error = %e,
                "failed to parse secret JSON; continuing with process env"
            ),
        },
        Err(e) => warn!(
            secret_name = %secret_name,
            error = %e,
            "failed to fetch secret; continuing with process env / .env"
        ),
    }
}

/// Full boot: dotenv → (caller inits tracing) → optional secret. Convenience for tests.
pub fn bootstrap_env() {
    load_dotenv();
    merge_optional_secret();
}

/// Fetch SecretString via AWS CLI (no heavy SDK dep; requires `aws` on PATH + credentials).
fn fetch_secret_json(secret_name: &str) -> Result<String, String> {
    let region = env_opt("AWS_REGION").or_else(|| env_opt("AWS_DEFAULT_REGION"));
    let mut cmd = std::process::Command::new("aws");
    cmd.args([
        "secretsmanager",
        "get-secret-value",
        "--secret-id",
        secret_name,
        "--query",
        "SecretString",
        "--output",
        "text",
    ]);
    if let Some(r) = region.as_deref() {
        cmd.args(["--region", r]);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("spawn aws CLI: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "aws secretsmanager get-secret-value failed ({}): {}",
            output.status,
            stderr.trim()
        ));
    }

    let s = String::from_utf8(output.stdout)
        .map_err(|e| format!("secret stdout not utf-8: {e}"))?;
    let trimmed = s.trim().to_string();
    if trimmed.is_empty() || trimmed == "None" {
        return Err("SecretString empty".into());
    }
    Ok(trimmed)
}
