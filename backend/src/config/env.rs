//! Shared env helpers: optional/required reads and network-scoped resolution.
//!
//! Resolution order for network-scoped keys:
//!   `{KEY}_{LOCALNET|DEVNET|MAINNET}` → `{KEY}` → None / bail

use anyhow::{bail, Result};

use crate::app_state::SolanaNetwork;

pub fn env_opt(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn env_required(key: &str) -> Result<String> {
    match env_opt(key) {
        Some(v) => Ok(v),
        None => bail!("{key} is required"),
    }
}

/// Prefer `{KEY}_{NETWORK}` then fall back to `{KEY}`.
pub fn env_for_network(base_key: &str, network: SolanaNetwork) -> Option<String> {
    let suffix = match network {
        SolanaNetwork::Localnet => "LOCALNET",
        SolanaNetwork::Devnet => "DEVNET",
        SolanaNetwork::Mainnet => "MAINNET",
    };
    let scoped = format!("{base_key}_{suffix}");
    env_opt(&scoped).or_else(|| env_opt(base_key))
}

pub fn env_for_network_required(base_key: &str, network: SolanaNetwork) -> Result<String> {
    match env_for_network(base_key, network) {
        Some(v) => Ok(v),
        None => {
            let suffix = match network {
                SolanaNetwork::Localnet => "LOCALNET",
                SolanaNetwork::Devnet => "DEVNET",
                SolanaNetwork::Mainnet => "MAINNET",
            };
            bail!("{base_key}_{suffix} or {base_key} is required")
        }
    }
}

/// Prefer primary key, then legacy alias (both must be non-empty if set).
pub fn env_prefer(primary: &str, alias: &str) -> Option<String> {
    env_opt(primary).or_else(|| env_opt(alias))
}

pub fn env_prefer_required(primary: &str, alias: &str) -> Result<String> {
    match env_prefer(primary, alias) {
        Some(v) => Ok(v),
        None => bail!("{primary} (or legacy {alias}) is required"),
    }
}

/// Fill process env with keys from a flat JSON object that are missing or empty.
/// Existing non-empty process env always wins.
pub fn merge_fill_missing(flat: &serde_json::Map<String, serde_json::Value>) -> usize {
    let mut filled = 0;
    for (key, value) in flat {
        let needs_fill = match std::env::var(key) {
            Ok(v) if !v.trim().is_empty() => false,
            _ => true,
        };
        if !needs_fill {
            continue;
        }
        let Some(s) = json_value_as_env_string(value) else {
            continue;
        };
        if s.is_empty() {
            continue;
        }
        // SAFETY: single-threaded at bootstrap before workers spawn.
        unsafe { std::env::set_var(key, s) };
        filled += 1;
    }
    filled
}

fn json_value_as_env_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        serde_json::Value::Null => None,
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn network_scoped_prefers_suffix() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::remove_var("TEST_MINT");
            std::env::remove_var("TEST_MINT_DEVNET");
            std::env::set_var("TEST_MINT", "base");
            std::env::set_var("TEST_MINT_DEVNET", "devnet-mint");
        }
        assert_eq!(
            env_for_network("TEST_MINT", SolanaNetwork::Devnet).as_deref(),
            Some("devnet-mint")
        );
        assert_eq!(
            env_for_network("TEST_MINT", SolanaNetwork::Localnet).as_deref(),
            Some("base")
        );
        unsafe {
            std::env::remove_var("TEST_MINT");
            std::env::remove_var("TEST_MINT_DEVNET");
        }
    }

    #[test]
    fn merge_does_not_overwrite() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("MERGE_KEEP", "local");
            std::env::remove_var("MERGE_FILL");
        }
        let mut map = serde_json::Map::new();
        map.insert(
            "MERGE_KEEP".into(),
            serde_json::Value::String("secret".into()),
        );
        map.insert(
            "MERGE_FILL".into(),
            serde_json::Value::String("from-secret".into()),
        );
        let n = merge_fill_missing(&map);
        assert_eq!(n, 1);
        assert_eq!(std::env::var("MERGE_KEEP").unwrap(), "local");
        assert_eq!(std::env::var("MERGE_FILL").unwrap(), "from-secret");
        unsafe {
            std::env::remove_var("MERGE_KEEP");
            std::env::remove_var("MERGE_FILL");
        }
    }
}
