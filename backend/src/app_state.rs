use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use anyhow::Context;
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;

/// Cluster the backend is wired to. Clients must send a matching `x-solana-network`
/// header so we never hand them a transaction built for a different network.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

    fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "mainnet" | "mainnet-beta" => Some(SolanaNetwork::Mainnet),
            "devnet" => Some(SolanaNetwork::Devnet),
            "localnet" | "localhost" => Some(SolanaNetwork::Localnet),
            _ => None,
        }
    }

    /// Best-effort inference from an RPC URL when `SOLANA_NETWORK` is not set.
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

/// Shared application state (Witan-style `Arc<AppState>`).
pub struct AppState {
    pub rpc: Arc<RpcClient>,
    pub http: reqwest::Client,
    pub program_id: Pubkey,
    /// `authority` pubkey used in `vault_config` PDA seeds `[b"vault_config", authority]`.
    pub vault_authority_seed: Pubkey,
    /// Default collateral mint when `assetMint` is omitted (typically USDC).
    pub default_asset_mint: String,
    pub jupiter_swap_api_base: String,
    pub jupiter_quote_api_base: String,
    /// Cluster this backend instance serves. Client requests with a mismatched
    /// `x-solana-network` header are rejected.
    pub network: SolanaNetwork,
}

impl AppState {
    pub fn from_env() -> anyhow::Result<Self> {
        let rpc_url = std::env::var("SOLANA_RPC_URL")
            .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());

        let network = match std::env::var("SOLANA_NETWORK") {
            Ok(v) => SolanaNetwork::from_str(&v)
                .map_err(|e| anyhow::anyhow!("{e}"))
                .context("SOLANA_NETWORK")?,
            Err(_) => SolanaNetwork::infer_from_rpc(&rpc_url),
        };

        let rpc = Arc::new(RpcClient::new_with_commitment(
            rpc_url,
            CommitmentConfig::confirmed(),
        ));

        let program_id = Pubkey::from_str(
            &std::env::var("PROGRAM_ID")
                .unwrap_or_else(|_| "5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT".to_string()),
        )
        .context("invalid PROGRAM_ID")?;

        let vault_authority_seed = Pubkey::from_str(&std::env::var("VAULT_AUTHORITY").context(
            "VAULT_AUTHORITY must be set to the vault `authority` pubkey (vault_config PDA seed)",
        )?)
        .context("invalid VAULT_AUTHORITY")?;

        let default_asset_mint = std::env::var("DEFAULT_ASSET_MINT").unwrap_or_else(|_| {
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string()
        });

        let jupiter_quote_api_base = std::env::var("JUPITER_QUOTE_API_BASE")
            .unwrap_or_else(|_| "https://quote-api.jup.ag/v6".to_string());
        let jupiter_swap_api_base = std::env::var("JUPITER_SWAP_API_BASE")
            .unwrap_or_else(|_| "https://quote-api.jup.ag/v6".to_string());

        let http = reqwest::Client::builder()
            .user_agent("wrap-stablecoin-api/0.1")
            .build()
            .expect("reqwest client");

        Ok(Self {
            rpc,
            http,
            program_id,
            vault_authority_seed,
            default_asset_mint,
            jupiter_swap_api_base,
            jupiter_quote_api_base,
            network,
        })
    }
}
