use anyhow::{anyhow, Context, Result};
use mpl_token_metadata::accounts::Metadata;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use utoipa::ToSchema;

#[derive(Debug, Clone, serde::Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MintMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub uri: String,
    pub update_authority: Option<String>,
    pub is_mutable: bool,
}

pub fn metadata_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            mint.as_ref(),
        ],
        &mpl_token_metadata::ID,
    )
}

pub fn fetch_mint_metadata(
    rpc: &RpcClient,
    mint: &Pubkey,
    decimals: u8,
) -> Result<Option<MintMetadata>> {
    let (metadata_key, _) = metadata_pda(mint);
    let account = rpc
        .get_account(&metadata_key)
        .context("fetch metadata account")?;
    if account.data.is_empty() {
        return Ok(None);
    }
    let metadata = Metadata::from_bytes(&account.data).map_err(|e| anyhow!("decode metadata: {e}"))?;
    let update_authority = if metadata.update_authority == Pubkey::default() {
        None
    } else {
        Some(metadata.update_authority.to_string())
    };
    Ok(Some(MintMetadata {
        name: trim_padding(&metadata.name),
        symbol: trim_padding(&metadata.symbol),
        decimals,
        uri: trim_padding(&metadata.uri),
        update_authority,
        is_mutable: metadata.is_mutable,
    }))
}

fn trim_padding(s: &str) -> String {
    s.trim_end_matches('\0').trim().to_string()
}
