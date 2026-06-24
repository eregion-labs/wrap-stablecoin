use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use solana_sdk::signature::Keypair;

/// Load a Solana keypair from a JSON byte array file (Anchor / solana-keygen format).
pub fn load_keypair(path: impl AsRef<Path>) -> Result<Keypair> {
    let data = std::fs::read_to_string(path.as_ref())
        .with_context(|| format!("read keypair {}", path.as_ref().display()))?;
    let bytes: Vec<u8> =
        serde_json::from_str(&data).context("parse keypair json as byte array")?;
    Keypair::from_bytes(&bytes).context("invalid keypair secret key length")
}

pub fn load_keypair_arc(path: impl AsRef<Path>) -> Result<Arc<Keypair>> {
    Ok(Arc::new(load_keypair(path)?))
}
