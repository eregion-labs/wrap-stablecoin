//! Index `TreasuryWithdrawn` events from txs that touch each asset's `treasury_vault`.
//!
//! ponytail: first GET after process start walks signatures via RPC (capped page count).
//! Persistent disk/DB index only if history outgrows that ceiling.

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

use anyhow::{anyhow, Context, Result};
use base64::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
use solana_client::rpc_client::{GetConfirmedSignaturesForAddress2Config, RpcClient};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signature;
use solana_transaction_status_client_types::{
    option_serializer::OptionSerializer, EncodedTransaction, UiMessage, UiTransactionEncoding,
    UiTransactionStatusMeta,
};
use utoipa::ToSchema;

use super::pda::{asset_config, treasury_vault, vault_config};

/// Cap how many signature pages we walk on a cold cache fill.
const MAX_SIG_PAGES: usize = 8;
const SIGS_PER_PAGE: usize = 100;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TreasuryWithdrawalRow {
    pub signature: String,
    pub amount: u64,
    /// Wallet owner (event stores the ATA; we resolve).
    pub destination: String,
    /// Tx fee payer.
    pub initiator: String,
    pub block_time: Option<i64>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TreasuryWithdrawalHistory {
    pub withdrawals: Vec<TreasuryWithdrawalRow>,
}

#[derive(Default)]
struct MintCache {
    /// Newest signature already indexed (exclusive bound for incremental fetches).
    until_sig: Option<Signature>,
    rows: Vec<TreasuryWithdrawalRow>,
}

/// In-process per-mint history cache.
#[derive(Default)]
pub struct TreasuryHistoryCache {
    inner: Mutex<HashMap<String, MintCache>>,
}

impl TreasuryHistoryCache {
    pub fn prepend(&self, mint: &Pubkey, row: TreasuryWithdrawalRow) {
        let key = mint.to_string();
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };
        let entry = guard.entry(key).or_default();
        if entry.rows.iter().any(|r| r.signature == row.signature) {
            return;
        }
        if let Ok(sig) = Signature::from_str(&row.signature) {
            entry.until_sig = Some(sig);
        }
        entry.rows.insert(0, row);
    }
}

fn event_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("event:{name}"));
    let hash = hasher.finalize();
    let mut out = [0u8; 8];
    out.copy_from_slice(&hash[..8]);
    out
}

/// Decode an Anchor `TreasuryWithdrawn` event payload (after the 8-byte discriminator).
pub fn decode_treasury_withdrawn_payload(
    data: &[u8],
) -> Option<(Pubkey, Pubkey, u64)> {
    if data.len() < 32 + 32 + 8 {
        return None;
    }
    let token_mint = Pubkey::new_from_array(data[0..32].try_into().ok()?);
    let destination = Pubkey::new_from_array(data[32..64].try_into().ok()?);
    let amount = u64::from_le_bytes(data[64..72].try_into().ok()?);
    Some((token_mint, destination, amount))
}

/// Parse `Program data: <base64>` logs for `TreasuryWithdrawn`.
pub fn parse_treasury_withdrawn_from_logs(
    logs: &[String],
) -> Option<(Pubkey, Pubkey, u64)> {
    let disc = event_discriminator("TreasuryWithdrawn");
    for line in logs {
        let Some(b64) = line.strip_prefix("Program data: ") else {
            continue;
        };
        let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.trim()) else {
            continue;
        };
        if bytes.len() < 8 || bytes[..8] != disc {
            continue;
        }
        if let Some(parsed) = decode_treasury_withdrawn_payload(&bytes[8..]) {
            return Some(parsed);
        }
    }
    None
}

fn token_account_owner(rpc: &RpcClient, ata: &Pubkey) -> Option<Pubkey> {
    let acc = rpc.get_account(ata).ok()?;
    // SPL token account: mint@0, owner@32
    if acc.data.len() < 64 {
        return None;
    }
    Pubkey::try_from(&acc.data[32..64]).ok()
}

fn fee_payer_from_encoded(tx: &EncodedTransaction) -> Option<Pubkey> {
    match tx {
        EncodedTransaction::Json(ui) => match &ui.message {
            UiMessage::Parsed(m) => m
                .account_keys
                .first()
                .and_then(|k| Pubkey::from_str(&k.pubkey).ok()),
            UiMessage::Raw(m) => m
                .account_keys
                .first()
                .and_then(|k| Pubkey::from_str(k).ok()),
        },
        _ => None,
    }
}

fn logs_from_meta(meta: &UiTransactionStatusMeta) -> Vec<String> {
    match &meta.log_messages {
        OptionSerializer::Some(logs) => logs.clone(),
        _ => Vec::new(),
    }
}

fn fetch_new_rows(
    rpc: &RpcClient,
    treasury: &Pubkey,
    until: Option<Signature>,
) -> Result<Vec<TreasuryWithdrawalRow>> {
    let mut out = Vec::new();
    let mut before: Option<Signature> = None;
    for _ in 0..MAX_SIG_PAGES {
        let page = rpc.get_signatures_for_address_with_config(
            treasury,
            GetConfirmedSignaturesForAddress2Config {
                before,
                until,
                limit: Some(SIGS_PER_PAGE),
                commitment: None,
            },
        )?;
        if page.is_empty() {
            break;
        }
        let last_sig = page.last().map(|s| s.signature.clone());
        for info in &page {
            if info.err.is_some() {
                continue;
            }
            let Ok(sig) = Signature::from_str(&info.signature) else {
                continue;
            };
            let Ok(tx_with_meta) = rpc.get_transaction(&sig, UiTransactionEncoding::Json) else {
                continue;
            };
            let Some(meta) = tx_with_meta.transaction.meta.as_ref() else {
                continue;
            };
            let logs = logs_from_meta(meta);
            let Some((_mint, dest_ata, amount)) = parse_treasury_withdrawn_from_logs(&logs) else {
                continue;
            };
            let destination = token_account_owner(rpc, &dest_ata)
                .unwrap_or(dest_ata)
                .to_string();
            let initiator = fee_payer_from_encoded(&tx_with_meta.transaction.transaction)
                .map(|p| p.to_string())
                .unwrap_or_default();
            out.push(TreasuryWithdrawalRow {
                signature: info.signature.clone(),
                amount,
                destination,
                initiator,
                block_time: info.block_time,
            });
        }
        // Oldest on this page becomes `before` for the next older page.
        let Some(last) = last_sig else {
            break;
        };
        let Ok(last) = Signature::from_str(&last) else {
            break;
        };
        if page.len() < SIGS_PER_PAGE {
            break;
        }
        before = Some(last);
    }
    // API returns newest-first; keep that order.
    Ok(out)
}

pub fn fetch_treasury_withdrawal_history(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    asset_mint: &Pubkey,
    cache: &TreasuryHistoryCache,
) -> Result<TreasuryWithdrawalHistory> {
    let (vault_config_key, _) = vault_config(program_id, vault_authority_seed);
    let (asset_config_key, _) = asset_config(program_id, &vault_config_key, asset_mint);
    let (treasury, _) = treasury_vault(program_id, &asset_config_key);
    let mint_key = asset_mint.to_string();

    let until = {
        let guard = cache
            .inner
            .lock()
            .map_err(|_| anyhow!("treasury history cache poisoned"))?;
        guard.get(&mint_key).and_then(|c| c.until_sig)
    };

    let new_rows = fetch_new_rows(rpc, &treasury, until)
        .with_context(|| format!("index treasury_vault {treasury}"))?;

    let mut guard = cache
        .inner
        .lock()
        .map_err(|_| anyhow!("treasury history cache poisoned"))?;
    let entry = guard.entry(mint_key).or_default();
    if !new_rows.is_empty() {
        if let Ok(sig) = Signature::from_str(&new_rows[0].signature) {
            entry.until_sig = Some(sig);
        }
        let existing: std::collections::HashSet<String> =
            entry.rows.iter().map(|r| r.signature.clone()).collect();
        let mut merged = new_rows
            .into_iter()
            .filter(|r| !existing.contains(&r.signature))
            .collect::<Vec<_>>();
        merged.append(&mut entry.rows);
        entry.rows = merged;
    } else if entry.until_sig.is_none() {
        // Cold empty: mark so we don't re-walk every time with until=None spanning forever.
        // Leave until_sig unset until we see a real sig; next call still walks (cheap if empty).
    }

    Ok(TreasuryWithdrawalHistory {
        withdrawals: entry.rows.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_treasury_withdrawn_fixture_log() {
        let token_mint = Pubkey::new_from_array([1u8; 32]);
        let destination = Pubkey::new_from_array([2u8; 32]);
        let amount: u64 = 77_601_165;
        let mut payload = Vec::with_capacity(8 + 72);
        payload.extend_from_slice(&event_discriminator("TreasuryWithdrawn"));
        payload.extend_from_slice(token_mint.as_ref());
        payload.extend_from_slice(destination.as_ref());
        payload.extend_from_slice(&amount.to_le_bytes());
        let b64 = base64::engine::general_purpose::STANDARD.encode(&payload);
        let logs = vec![
            "Program log: Instruction: WithdrawTreasury".to_string(),
            format!("Program data: {b64}"),
        ];
        let parsed = parse_treasury_withdrawn_from_logs(&logs).expect("decode");
        assert_eq!(parsed.0, token_mint);
        assert_eq!(parsed.1, destination);
        assert_eq!(parsed.2, amount);
    }

    #[test]
    fn wrong_discriminator_ignored() {
        let mut payload = Vec::with_capacity(8 + 72);
        payload.extend_from_slice(&event_discriminator("Harvested"));
        payload.extend_from_slice(&[0u8; 72]);
        let b64 = base64::engine::general_purpose::STANDARD.encode(&payload);
        let logs = vec![format!("Program data: {b64}")];
        assert!(parse_treasury_withdrawn_from_logs(&logs).is_none());
    }
}
