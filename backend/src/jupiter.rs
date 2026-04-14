//! Jupiter v6 quote + swap helpers (reqwest). Used for `/v1/tx/compose` swap bookends.

use anyhow::{anyhow, Context, Result};
use serde_json::Value;

use crate::app_state::AppState;

/// GET `/quote` — returns JSON quote (pass-through for swap step).
pub async fn fetch_quote(
    state: &AppState,
    query: &str,
) -> Result<Value> {
    let url = format!("{}/quote?{query}", state.jupiter_quote_api_base.trim_end_matches('/'));
    let v = state
        .http
        .get(&url)
        .send()
        .await
        .with_context(|| format!("jupiter quote GET {url}"))?
        .error_for_status()
        .with_context(|| format!("jupiter quote status {url}"))?
        .json()
        .await
        .with_context(|| "jupiter quote json")?;
    Ok(v)
}

/// POST `/swap` — returns `swapTransaction` base64 (Jupiter v6).
pub async fn fetch_swap_transaction_b64(
    state: &AppState,
    quote_response: &Value,
    user_public_key: &str,
) -> Result<String> {
    let url = format!("{}/swap", state.jupiter_swap_api_base.trim_end_matches('/'));
    let body = serde_json::json!({
        "quoteResponse": quote_response,
        "userPublicKey": user_public_key,
        "wrapAndUnwrapSol": true,
        "dynamicComputeUnitLimit": true,
        "prioritizationFeeLamports": "auto",
    });
    let resp: Value = state
        .http
        .post(&url)
        .json(&body)
        .send()
        .await
        .with_context(|| format!("jupiter swap POST {url}"))?
        .error_for_status()
        .with_context(|| format!("jupiter swap status {url}"))?
        .json()
        .await
        .with_context(|| "jupiter swap json")?;

    resp.get("swapTransaction")
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| anyhow!("swapTransaction missing in Jupiter response"))
}
