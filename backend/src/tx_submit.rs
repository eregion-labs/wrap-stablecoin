use anyhow::{Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::signature::{Keypair, Signature};
use solana_sdk::transaction::VersionedTransaction;

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
    rpc.send_and_confirm_transaction(&signed)
        .context("send and confirm transaction")
}
