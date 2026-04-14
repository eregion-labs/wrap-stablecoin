use std::str::FromStr;
use std::sync::Arc;

use anyhow::Context;
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;

/// Shared application state (Witan-style `Arc<AppState>`).
pub struct AppState {
    pub rpc: Arc<RpcClient>,
    pub http: reqwest::Client,
    pub program_id: Pubkey,
    /// `authority` pubkey used in `vault_config` PDA seeds `[b"vault_config", authority]`.
    pub vault_authority_seed: Pubkey,
    pub jupiter_swap_api_base: String,
    pub jupiter_quote_api_base: String,
}

impl AppState {
    pub fn from_env() -> anyhow::Result<Self> {
        let rpc_url = std::env::var("SOLANA_RPC_URL")
            .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
        let rpc = Arc::new(RpcClient::new_with_commitment(
            rpc_url,
            CommitmentConfig::confirmed(),
        ));

        let program_id = Pubkey::from_str(
            &std::env::var("PROGRAM_ID")
                .unwrap_or_else(|_| "5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT".to_string()),
        )
        .context("invalid PROGRAM_ID")?;

        let vault_authority_seed = Pubkey::from_str(
            &std::env::var("VAULT_AUTHORITY").context(
                "VAULT_AUTHORITY must be set to the vault `authority` pubkey (vault_config PDA seed)",
            )?,
        )
        .context("invalid VAULT_AUTHORITY")?;

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
            jupiter_swap_api_base,
            jupiter_quote_api_base,
        })
    }
}
