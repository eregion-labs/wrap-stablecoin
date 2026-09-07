use anyhow::{anyhow, Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::signature::{Keypair, Signature};
use solana_sdk::transaction::VersionedTransaction;

/// Prefer Solana client error text (includes simulation logs) over a generic wrapper.
fn format_send_err(err: impl std::fmt::Display) -> anyhow::Error {
    let s = err.to_string();
    // Drop the common "RPC response error -32002: " prefix when present for snackbars.
    let trimmed = s
        .strip_prefix("RPC response error -32002: ")
        .or_else(|| s.strip_prefix("RPC response error -32002 Transaction simulation failed: "))
        .unwrap_or(&s);
    anyhow!("{trimmed}")
}

/// Deserialize an unsigned versioned transaction, sign with the given keypairs, and submit.
pub fn sign_and_send_versioned_tx(
    rpc: &RpcClient,
    raw: &[u8],
    signers: &[&Keypair],
) -> Result<Signature> {
    let vtx: VersionedTransaction =
        bincode::deserialize(raw).context("deserialize versioned transaction")?;
    let signed = VersionedTransaction::try_new(vtx.message, signers)
        .context("sign versioned transaction")?;
    match rpc.send_and_confirm_transaction(&signed) {
        Ok(sig) => Ok(sig),
        Err(e) => Err(format_send_err(e)),
    }
}
