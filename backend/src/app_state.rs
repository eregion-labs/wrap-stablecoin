use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use anyhow::{Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;

use crate::admin_wallet::load_keypair_arc;
use crate::config::env::{env_for_network_required, env_opt, env_required};
use crate::config::PublicClientConfig;
use crate::wrap_stablecoin::load_klend_scope_prices_from_env;

/// Solana cluster this API deployment serves.
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

/// Per-deployment RPC + on-chain settings (exactly one cluster per process).
pub struct NetworkContext {
    pub network: SolanaNetwork,
    pub rpc: Arc<RpcClient>,
    pub program_id: Pubkey,
    /// `authority` pubkey used in `vault_config` PDA seeds.
    pub vault_authority_seed: Pubkey,
    pub default_asset_mint: String,
    /// Vault admin signer for server-side admin operations (optional).
    pub admin_keypair: Option<Arc<Keypair>>,
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

/// Shared application state. One Solana network per deployment.
pub struct AppState {
    pub primary_solana_network: SolanaNetwork,
    pub network: NetworkContext,
    pub public_client_config: Arc<PublicClientConfig>,
    /// KLend reserve pubkey → Scope oracle, used for `refresh_reserve`.
    pub klend_scope_prices: HashMap<Pubkey, Pubkey>,
}

impl AppState {
    pub fn from_env() -> Result<Self> {
        let rpc_url = env_required("SOLANA_RPC_URL")?;
        let network = match env_opt("SOLANA_NETWORK") {
            Some(v) => SolanaNetwork::from_str(&v).map_err(|e| anyhow::anyhow!("{e}"))?,
            None => SolanaNetwork::infer_from_rpc(&rpc_url),
        };

        let program_id = env_for_network_required("PROGRAM_ID", network)?;
        let vault_authority = env_for_network_required("VAULT_AUTHORITY", network)?;
        let default_asset_mint = env_for_network_required("DEFAULT_ASSET_MINT", network)?;
        let admin_keypair_path = env_opt("ADMIN_KEYPAIR_PATH");

        let ctx = Self::build_context(
            network,
            rpc_url,
            program_id,
            vault_authority,
            default_asset_mint,
            admin_keypair_path,
        )?;

        let public_client_config = Arc::new(PublicClientConfig::from_env(
            network,
            &ctx.program_id,
            &ctx.default_asset_mint,
        )?);

        Ok(Self {
            primary_solana_network: network,
            network: ctx,
            public_client_config,
            klend_scope_prices: load_klend_scope_prices_from_env(),
        })
    }

    /// Resolve network context. With single-network deployments this must match primary.
    pub fn require_network(&self, network: SolanaNetwork) -> Result<&NetworkContext, String> {
        if network != self.primary_solana_network {
            return Err(format!(
                "network `{network}` does not match this deployment's primary network `{}`",
                self.primary_solana_network
            ));
        }
        Ok(&self.network)
    }

    fn build_context(
        network: SolanaNetwork,
        rpc_url: String,
        program_id: String,
        vault_authority: String,
        default_asset_mint: String,
        admin_keypair_path: Option<String>,
    ) -> Result<NetworkContext> {
        let rpc = Arc::new(RpcClient::new_with_commitment(
            rpc_url,
            CommitmentConfig::confirmed(),
        ));
        let program_id =
            Pubkey::from_str(&program_id).context(format!("invalid {network} program id"))?;
        let vault_authority_seed = Pubkey::from_str(&vault_authority)
            .context(format!("invalid {network} vault authority"))?;
        // Reject invalid default mint early (also validated in PublicClientConfig).
        Pubkey::from_str(&default_asset_mint).context("invalid DEFAULT_ASSET_MINT")?;
        let admin_keypair = admin_keypair_path
            .map(load_keypair_arc)
            .transpose()
            .context(format!("load {network} admin keypair"))?;

        Ok(NetworkContext {
            network,
            rpc,
            program_id,
            vault_authority_seed,
            default_asset_mint,
            admin_keypair,
        })
    }
}
