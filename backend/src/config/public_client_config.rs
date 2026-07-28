use anyhow::{bail, Context, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use crate::app_state::SolanaNetwork;
use crate::config::env::{env_opt, env_prefer_required};

pub const SCHEMA_VERSION: u32 = 1;

/// App deployment tier — independent of Solana cluster.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AppEnvironment {
    Local,
    Development,
    Staging,
    Production,
}

impl AppEnvironment {
    pub fn as_str(self) -> &'static str {
        match self {
            AppEnvironment::Local => "local",
            AppEnvironment::Development => "development",
            AppEnvironment::Staging => "staging",
            AppEnvironment::Production => "production",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "local" | "localnet" => Some(AppEnvironment::Local),
            "development" | "dev" | "devnet" => Some(AppEnvironment::Development),
            "staging" | "stage" => Some(AppEnvironment::Staging),
            "production" | "prod" => Some(AppEnvironment::Production),
            _ => None,
        }
    }
}

impl FromStr for AppEnvironment {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s).ok_or_else(|| format!("unknown APP_ENV: {s}"))
    }
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicClientConfig {
    pub schema_version: u32,
    pub deployment_id: String,
    pub environment: String,
    pub solana: PublicSolanaConfig,
    pub assets: PublicAssetsConfig,
    pub features: PublicFeaturesConfig,
    pub links: PublicLinksConfig,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicSolanaConfig {
    pub network: String,
    pub rpc_url: String,
    pub ws_url: String,
    pub program_ids: PublicProgramIds,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicProgramIds {
    pub wrap_stablecoin: String,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicAssetsConfig {
    pub default_asset_mint: String,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicFeaturesConfig {
    pub capabilities: PublicCapabilities,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicCapabilities {
    pub jupiter_compose: bool,
    pub admin_dashboard: bool,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublicLinksConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admin_dashboard_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_app_url: Option<String>,
    /// Browser explorer base (e.g. https://solscan.io). Always present for frontends.
    pub explorer_base_url: String,
}

impl PublicClientConfig {
    /// Build immutable public client config from env. Fail fast on incoherent deployment.
    pub fn from_env(
        network: SolanaNetwork,
        program_id: &Pubkey,
        default_asset_mint: &str,
    ) -> Result<Self> {
        let environment = Self::load_environment()?;
        let deployment_id = Self::load_deployment_id(environment)?;

        // Prefer CLIENT_SOLANA_* (Folkmoot naming); accept PUBLIC_SOLANA_* as legacy alias.
        let public_rpc =
            env_prefer_required("CLIENT_SOLANA_RPC_URL", "PUBLIC_SOLANA_RPC_URL")?;
        let public_ws = env_prefer_required("CLIENT_SOLANA_WS_URL", "PUBLIC_SOLANA_WS_URL")?;
        validate_url(&public_rpc, "CLIENT_SOLANA_RPC_URL")?;
        validate_url(&public_ws, "CLIENT_SOLANA_WS_URL")?;

        let mint = Pubkey::from_str(default_asset_mint)
            .context("DEFAULT_ASSET_MINT is not a valid pubkey")?;

        let admin_dashboard_url = env_opt("ADMIN_DASHBOARD_URL").or_else(|| {
            if environment == AppEnvironment::Local {
                Some("http://localhost:3002".to_string())
            } else {
                None
            }
        });
        let public_app_url = env_opt("PUBLIC_APP_URL");
        let explorer_base_url = env_opt("EXPLORER_BASE_URL")
            .unwrap_or_else(|| "https://solscan.io".to_string());
        validate_url(&explorer_base_url, "EXPLORER_BASE_URL")?;

        let jupiter_compose = env_opt("CAPABILITY_JUPITER_COMPOSE")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true);
        let admin_dashboard = env_opt("CAPABILITY_ADMIN_DASHBOARD")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true);

        Ok(Self {
            schema_version: SCHEMA_VERSION,
            deployment_id,
            environment: environment.as_str().to_string(),
            solana: PublicSolanaConfig {
                network: network.as_header().to_string(),
                rpc_url: public_rpc,
                ws_url: public_ws,
                program_ids: PublicProgramIds {
                    wrap_stablecoin: program_id.to_string(),
                },
            },
            assets: PublicAssetsConfig {
                default_asset_mint: mint.to_string(),
            },
            features: PublicFeaturesConfig {
                capabilities: PublicCapabilities {
                    jupiter_compose,
                    admin_dashboard,
                },
            },
            links: PublicLinksConfig {
                admin_dashboard_url,
                public_app_url,
                explorer_base_url,
            },
        })
    }

    pub fn etag(&self) -> Result<String> {
        let json = serde_json::to_vec(self).context("serialize PublicClientConfig for ETag")?;
        let hash = Sha256::digest(&json);
        Ok(format!("\"{}\"", hex_encode(&hash[..8])))
    }

    fn load_environment() -> Result<AppEnvironment> {
        match env_opt("APP_ENV") {
            Some(v) => AppEnvironment::from_str(&v).map_err(|e| anyhow::anyhow!("{e}")),
            None => Ok(AppEnvironment::Local),
        }
    }

    fn load_deployment_id(environment: AppEnvironment) -> Result<String> {
        if let Some(id) = env_opt("DEPLOYMENT_ID") {
            return Ok(id);
        }
        if environment == AppEnvironment::Local {
            return Ok("local-dev".to_string());
        }
        bail!("DEPLOYMENT_ID is required when APP_ENV is not local")
    }
}

fn validate_url(url: &str, key: &str) -> Result<()> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("ws://")
        || lower.starts_with("wss://"))
    {
        bail!("{key} must be an absolute http(s) or ws(s) URL");
    }
    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_sdk::signature::Keypair;
    use solana_sdk::signer::Signer;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_clean_env<F: FnOnce()>(f: F) {
        let _guard = ENV_LOCK.lock().unwrap();
        for key in [
            "APP_ENV",
            "DEPLOYMENT_ID",
            "CLIENT_SOLANA_RPC_URL",
            "CLIENT_SOLANA_WS_URL",
            "PUBLIC_SOLANA_RPC_URL",
            "PUBLIC_SOLANA_WS_URL",
            "ADMIN_DASHBOARD_URL",
            "PUBLIC_APP_URL",
            "EXPLORER_BASE_URL",
            "CAPABILITY_JUPITER_COMPOSE",
            "CAPABILITY_ADMIN_DASHBOARD",
        ] {
            unsafe { std::env::remove_var(key) };
        }
        f();
    }

    #[test]
    fn builds_local_config() {
        with_clean_env(|| {
            unsafe {
                std::env::set_var("APP_ENV", "local");
                std::env::set_var("CLIENT_SOLANA_RPC_URL", "http://127.0.0.1:8901");
                std::env::set_var("CLIENT_SOLANA_WS_URL", "ws://127.0.0.1:8900");
            }
            let program = Keypair::new().pubkey();
            let mint = Keypair::new().pubkey();
            let cfg = PublicClientConfig::from_env(SolanaNetwork::Localnet, &program, &mint.to_string())
                .unwrap();
            assert_eq!(cfg.schema_version, 1);
            assert_eq!(cfg.deployment_id, "local-dev");
            assert_eq!(cfg.environment, "local");
            assert_eq!(cfg.solana.network, "localnet");
            assert_eq!(cfg.solana.program_ids.wrap_stablecoin, program.to_string());
            assert_eq!(cfg.assets.default_asset_mint, mint.to_string());
            assert_eq!(
                cfg.links.admin_dashboard_url.as_deref(),
                Some("http://localhost:3002")
            );
            assert_eq!(cfg.links.explorer_base_url, "https://solscan.io");
            let json = serde_json::to_string(&cfg).unwrap();
            assert!(!json.contains("ADMIN_KEYPAIR"));
            assert!(!json.contains("keypair"));
        });
    }

    #[test]
    fn accepts_legacy_public_solana_aliases() {
        with_clean_env(|| {
            unsafe {
                std::env::set_var("APP_ENV", "local");
                std::env::set_var("PUBLIC_SOLANA_RPC_URL", "http://127.0.0.1:8901");
                std::env::set_var("PUBLIC_SOLANA_WS_URL", "ws://127.0.0.1:8900");
            }
            let program = Keypair::new().pubkey();
            let mint = Keypair::new().pubkey().to_string();
            let cfg = PublicClientConfig::from_env(SolanaNetwork::Localnet, &program, &mint)
                .unwrap();
            assert_eq!(cfg.solana.rpc_url, "http://127.0.0.1:8901");
        });
    }

    #[test]
    fn requires_deployment_id_outside_local() {
        with_clean_env(|| {
            unsafe {
                std::env::set_var("APP_ENV", "development");
                std::env::set_var("CLIENT_SOLANA_RPC_URL", "https://api.devnet.solana.com");
                std::env::set_var("CLIENT_SOLANA_WS_URL", "wss://api.devnet.solana.com");
            }
            let program = Keypair::new().pubkey();
            let mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
            let err = PublicClientConfig::from_env(SolanaNetwork::Devnet, &program, mint)
                .unwrap_err()
                .to_string();
            assert!(err.contains("DEPLOYMENT_ID"));
        });
    }

    #[test]
    fn etag_changes_when_config_changes() {
        with_clean_env(|| {
            unsafe {
                std::env::set_var("APP_ENV", "local");
                std::env::set_var("CLIENT_SOLANA_RPC_URL", "http://127.0.0.1:8901");
                std::env::set_var("CLIENT_SOLANA_WS_URL", "ws://127.0.0.1:8900");
            }
            let program = Keypair::new().pubkey();
            let mint = Keypair::new().pubkey().to_string();
            let a = PublicClientConfig::from_env(SolanaNetwork::Localnet, &program, &mint).unwrap();
            unsafe { std::env::set_var("DEPLOYMENT_ID", "other") };
            let b = PublicClientConfig::from_env(SolanaNetwork::Localnet, &program, &mint).unwrap();
            assert_ne!(a.etag().unwrap(), b.etag().unwrap());
        });
    }
}
