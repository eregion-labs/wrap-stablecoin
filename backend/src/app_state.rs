use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use anyhow::{bail, Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;

/// Cluster selected by the frontend via `x-solana-network`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SolanaNetwork {
    Mainnet,
    Devnet,
    Localnet,
}

impl SolanaNetwork {
    pub fn as_header(&self) -> &'static str {
        match self {
            SolanaNetwork::Mainnet => "mainnet",
            SolanaNetwork::Devnet => "devnet",
            SolanaNetwork::Localnet => "localnet",
        }
    }

    fn env_prefix(self) -> &'static str {
        match self {
            SolanaNetwork::Mainnet => "MAINNET",
            SolanaNetwork::Devnet => "DEVNET",
            SolanaNetwork::Localnet => "LOCALNET",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "mainnet" | "mainnet-beta" => Some(SolanaNetwork::Mainnet),
            "devnet" => Some(SolanaNetwork::Devnet),
            "localnet" | "localhost" => Some(SolanaNetwork::Localnet),
            _ => None,
        }
    }

    fn infer_from_rpc(url: &str) -> Self {
        let u = url.to_ascii_lowercase();
        if u.contains("devnet") {
            SolanaNetwork::Devnet
        } else if u.contains("127.0.0.1") || u.contains("localhost") {
            SolanaNetwork::Localnet
        } else {
            SolanaNetwork::Mainnet
        }
    }

    pub fn all() -> [Self; 3] {
        [
            SolanaNetwork::Localnet,
            SolanaNetwork::Devnet,
            SolanaNetwork::Mainnet,
        ]
    }
}

impl fmt::Display for SolanaNetwork {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_header())
    }
}

impl FromStr for SolanaNetwork {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        SolanaNetwork::parse(s).ok_or_else(|| format!("unknown solana network: {s}"))
    }
}

/// Per-cluster RPC + on-chain deployment settings.
pub struct NetworkContext {
    pub network: SolanaNetwork,
    pub rpc: Arc<RpcClient>,
    pub program_id: Pubkey,
    /// `authority` pubkey used in `vault_config` PDA seeds.
    pub vault_authority_seed: Pubkey,
    pub default_asset_mint: String,
}

impl NetworkContext {
    pub fn resolve_asset_mint(&self, asset_mint: Option<&str>) -> Result<Pubkey, String> {
        match asset_mint {
            Some(m) => Pubkey::from_str(m).map_err(|e| format!("invalid assetMint: {e}")),
            None => Pubkey::from_str(&self.default_asset_mint)
                .map_err(|e| format!("invalid default asset mint: {e}")),
        }
    }
}

/// Shared application state. Cluster is chosen per request by the client header.
pub struct AppState {
    pub http: reqwest::Client,
    pub jupiter_swap_api_base: String,
    pub jupiter_quote_api_base: String,
    networks: HashMap<SolanaNetwork, NetworkContext>,
}

impl AppState {
    pub fn from_env() -> Result<Self> {
        let mut networks = HashMap::new();

        for network in SolanaNetwork::all() {
            if let Some(ctx) = Self::try_load_prefixed(network)? {
                networks.insert(network, ctx);
            }
        }

        if let Some((network, ctx)) = Self::try_load_legacy()? {
            networks.entry(network).or_insert(ctx);
        }

        if networks.is_empty() {
            bail!(
                "configure at least one network via LOCALNET_* / DEVNET_* env vars \
                 (or legacy SOLANA_RPC_URL + PROGRAM_ID + VAULT_AUTHORITY)"
            );
        }

        let jupiter_quote_api_base = std::env::var("JUPITER_QUOTE_API_BASE")
            .unwrap_or_else(|_| "https://quote-api.jup.ag/v6".to_string());
        let jupiter_swap_api_base = std::env::var("JUPITER_SWAP_API_BASE")
            .unwrap_or_else(|_| "https://quote-api.jup.ag/v6".to_string());

        let http = reqwest::Client::builder()
            .user_agent("wrap-stablecoin-api/0.1")
            .build()
            .expect("reqwest client");

        Ok(Self {
            http,
            jupiter_swap_api_base,
            jupiter_quote_api_base,
            networks,
        })
    }

    pub fn configured_networks(&self) -> Vec<&'static str> {
        let mut out: Vec<_> = self
            .networks
            .keys()
            .map(|n| n.as_header())
            .collect();
        out.sort_unstable();
        out
    }

    pub fn require_network(&self, network: SolanaNetwork) -> Result<&NetworkContext, String> {
        self.networks.get(&network).ok_or_else(|| {
            format!(
                "network `{network}` is not configured on this API; available: {}",
                self.configured_networks().join(", ")
            )
        })
    }

    fn env_opt(key: &str) -> Option<String> {
        std::env::var(key)
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }

    fn try_load_prefixed(network: SolanaNetwork) -> Result<Option<NetworkContext>> {
        let prefix = network.env_prefix();
        let rpc_url = Self::env_opt(&format!("{prefix}_RPC_URL"));
        let program_id = Self::env_opt(&format!("{prefix}_PROGRAM_ID"));
        let vault_authority = Self::env_opt(&format!("{prefix}_VAULT_AUTHORITY"));

        let set = [rpc_url.is_some(), program_id.is_some(), vault_authority.is_some()];
        if !set.iter().any(|v| *v) {
            return Ok(None);
        }
        if !set.iter().all(|v| *v) {
            bail!(
                "incomplete {prefix}_* config: set {prefix}_RPC_URL, {prefix}_PROGRAM_ID, and {prefix}_VAULT_AUTHORITY together"
            );
        }

        let default_asset_mint = Self::env_opt(&format!("{prefix}_DEFAULT_ASSET_MINT"))
            .unwrap_or_else(|| "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string());

        Self::build_context(
            network,
            rpc_url.unwrap(),
            program_id.unwrap(),
            vault_authority.unwrap(),
            default_asset_mint,
        )
        .map(Some)
    }

    fn try_load_legacy() -> Result<Option<(SolanaNetwork, NetworkContext)>> {
        let rpc_url = match Self::env_opt("SOLANA_RPC_URL") {
            Some(v) => v,
            None => return Ok(None),
        };

        let network = match Self::env_opt("SOLANA_NETWORK") {
            Some(v) => SolanaNetwork::from_str(&v).map_err(|e| anyhow::anyhow!("{e}"))?,
            None => SolanaNetwork::infer_from_rpc(&rpc_url),
        };

        let program_id = Self::env_opt("PROGRAM_ID")
            .context("PROGRAM_ID required when SOLANA_RPC_URL is set")?;
        let vault_authority = Self::env_opt("VAULT_AUTHORITY")
            .context("VAULT_AUTHORITY required when SOLANA_RPC_URL is set")?;
        let default_asset_mint = Self::env_opt("DEFAULT_ASSET_MINT")
            .unwrap_or_else(|| "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string());

        let ctx = Self::build_context(
            network,
            rpc_url,
            program_id,
            vault_authority,
            default_asset_mint,
        )?;
        Ok(Some((network, ctx)))
    }

    fn build_context(
        network: SolanaNetwork,
        rpc_url: String,
        program_id: String,
        vault_authority: String,
        default_asset_mint: String,
    ) -> Result<NetworkContext> {
        let rpc = Arc::new(RpcClient::new_with_commitment(
            rpc_url,
            CommitmentConfig::confirmed(),
        ));
        let program_id =
            Pubkey::from_str(&program_id).context(format!("invalid {} program id", network))?;
        let vault_authority_seed = Pubkey::from_str(&vault_authority)
            .context(format!("invalid {} vault authority", network))?;

        Ok(NetworkContext {
            network,
            rpc,
            program_id,
            vault_authority_seed,
            default_asset_mint,
        })
    }
}
