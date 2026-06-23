use anchor_lang::AccountDeserialize;
use anchor_lang::AnchorSerialize;
use anyhow::{anyhow, Context, Result};
use wrap_stablecoin::state::{AssetConfig, AssetStatus, KLendConfig, VaultConfig};
use wrap_stablecoin::utils::wrapped_to_underlying_amount;
use wrap_stablecoin::{UnwrapArgs, WrapArgs};
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::hash::Hash;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::message::legacy::Message as LegacyMessage;
use solana_sdk::message::{v0::Message, VersionedMessage};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signature;
use solana_sdk::transaction::VersionedTransaction;
use spl_associated_token_account::get_associated_token_address;
use spl_associated_token_account::instruction::create_associated_token_account_idempotent;
use spl_token::id as spl_token_program_id;
use utoipa::ToSchema;

use super::{asset_config, vault_authority, vault_config};

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}

pub fn wrap_ix_data(amount: u64) -> Result<Vec<u8>> {
    let mut data = anchor_sighash("global", "wrap").to_vec();
    data.extend(
        WrapArgs { amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh wrap args: {e}"))?,
    );
    Ok(data)
}

pub fn unwrap_ix_data(amount: u64) -> Result<Vec<u8>> {
    let mut data = anchor_sighash("global", "unwrap").to_vec();
    data.extend(
        UnwrapArgs { amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh unwrap args: {e}"))?,
    );
    Ok(data)
}

pub fn build_wrap_instruction(
    program_id: &Pubkey,
    user: &Pubkey,
    vault: &VaultConfig,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_cfg: &AssetConfig,
    asset_config_key: &Pubkey,
    amount: u64,
) -> Result<Instruction> {
    let data = wrap_ix_data(amount)?;

    let accounts = vec![
        AccountMeta::new(*user, true),
        AccountMeta::new(*vault_config_key, false),
        AccountMeta::new_readonly(*vault_authority_key, false),
        AccountMeta::new(*asset_config_key, false),
        AccountMeta::new_readonly(asset_cfg.token_mint, false),
        AccountMeta::new(
            get_associated_token_address(user, &asset_cfg.token_mint),
            false,
        ),
        AccountMeta::new(
            get_associated_token_address(user, &vault.wrapped_mint),
            false,
        ),
        AccountMeta::new(vault.wrapped_mint, false),
        AccountMeta::new(asset_cfg.token_vault, false),
        AccountMeta::new_readonly(spl_token_program_id(), false),
    ];

    Ok(Instruction {
        program_id: *program_id,
        accounts,
        data,
    })
}

pub fn build_unwrap_instruction(
    program_id: &Pubkey,
    user: &Pubkey,
    vault: &VaultConfig,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_cfg: &AssetConfig,
    asset_config_key: &Pubkey,
    amount: u64,
) -> Result<Instruction> {
    let data = unwrap_ix_data(amount)?;

    let accounts = vec![
        AccountMeta::new(*user, true),
        AccountMeta::new(*vault_config_key, false),
        AccountMeta::new_readonly(*vault_authority_key, false),
        AccountMeta::new(
            get_associated_token_address(user, &vault.wrapped_mint),
            false,
        ),
        AccountMeta::new(
            get_associated_token_address(user, &asset_cfg.token_mint),
            false,
        ),
        AccountMeta::new(vault.wrapped_mint, false),
        AccountMeta::new(*asset_config_key, false),
        AccountMeta::new_readonly(asset_cfg.token_mint, false),
        AccountMeta::new(asset_cfg.token_vault, false),
        AccountMeta::new_readonly(spl_token_program_id(), false),
    ];

    Ok(Instruction {
        program_id: *program_id,
        accounts,
        data,
    })
}

fn fetch_vault_config(
    rpc: &RpcClient,
    program_id: &Pubkey,
    authority: &Pubkey,
) -> Result<(Pubkey, VaultConfig)> {
    let (addr, _) = vault_config(program_id, authority);
    let acc = rpc
        .get_account(&addr)
        .with_context(|| format!("vault_config {addr}"))?;
    let mut data: &[u8] = &acc.data;
    let v =
        VaultConfig::try_deserialize(&mut data).map_err(|e| anyhow!("vault_config decode: {e}"))?;
    Ok((addr, v))
}

fn fetch_asset_config(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_config_key: &Pubkey,
    token_mint: &Pubkey,
) -> Result<(Pubkey, AssetConfig)> {
    let (addr, _) = asset_config(program_id, vault_config_key, token_mint);
    let acc = rpc
        .get_account(&addr)
        .with_context(|| format!("asset_config {addr}"))?;
    let mut data: &[u8] = &acc.data;
    let t =
        AssetConfig::try_deserialize(&mut data).map_err(|e| anyhow!("asset_config decode: {e}"))?;
    Ok((addr, t))
}

fn get_token_account_amount(rpc: &RpcClient, ata: &Pubkey) -> Result<u64> {
    let acc = rpc
        .get_account(ata)
        .with_context(|| format!("token account {ata}"))?;
    if acc.data.len() < 72 {
        return Ok(0);
    }
    Ok(u64::from_le_bytes(acc.data[64..72].try_into().unwrap()))
}

pub fn build_versioned_tx(
    rpc: &RpcClient,
    payer: &Pubkey,
    instructions: Vec<Instruction>,
    recent_blockhash: Option<Hash>,
) -> Result<VersionedTransaction> {
    let blockhash = match recent_blockhash {
        Some(h) => h,
        None => rpc.get_latest_blockhash()?,
    };
    let msg = Message::try_compile(payer, &instructions, &[], blockhash)
        .map_err(|e| anyhow!("try_compile: {e:?}"))?;
    let n = msg.header.num_required_signatures as usize;
    Ok(VersionedTransaction {
        signatures: vec![Signature::default(); n],
        message: VersionedMessage::V0(msg),
    })
}

pub fn unsigned_wrap_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    user: &Pubkey,
    asset_mint: &Pubkey,
    amount: u64,
) -> Result<Vec<u8>> {
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if vault.paused {
        return Err(anyhow!("vault is paused"));
    }
    if !vault.has_asset(asset_mint) {
        return Err(anyhow!("asset not registered: {asset_mint}"));
    }
    let (vault_authority_key, _) = vault_authority(program_id, &vault_config_key);
    let (asset_config_key, asset_cfg) =
        fetch_asset_config(rpc, program_id, &vault_config_key, asset_mint)?;
    if !asset_cfg.mint_allowed() {
        return Err(anyhow!("mint disabled for asset"));
    }

    let create_user_wrapped_ata = create_associated_token_account_idempotent(
        user,
        user,
        &vault.wrapped_mint,
        &spl_token_program_id(),
    );

    let create_user_asset_ata = create_associated_token_account_idempotent(
        user,
        user,
        asset_mint,
        &spl_token_program_id(),
    );

    let wrap_ix = build_wrap_instruction(
        program_id,
        user,
        &vault,
        &vault_config_key,
        &vault_authority_key,
        &asset_cfg,
        &asset_config_key,
        amount,
    )?;

    let tx = build_versioned_tx(
        rpc,
        user,
        vec![create_user_asset_ata, create_user_wrapped_ata, wrap_ix],
        None,
    )?;
    bincode::serialize(&tx).map_err(|e| anyhow!("serialize tx: {e}"))
}

pub fn unsigned_unwrap_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    user: &Pubkey,
    asset_mint: &Pubkey,
    amount: u64,
) -> Result<Vec<u8>> {
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if vault.paused {
        return Err(anyhow!("vault is paused"));
    }
    if !vault.has_asset(asset_mint) {
        return Err(anyhow!("asset not registered: {asset_mint}"));
    }
    let (vault_authority_key, _) = vault_authority(program_id, &vault_config_key);
    let (asset_config_key, asset_cfg) =
        fetch_asset_config(rpc, program_id, &vault_config_key, asset_mint)?;
    if !asset_cfg.redeem_allowed() {
        return Err(anyhow!("redemption disabled for asset"));
    }

    let create_user_asset_ata = create_associated_token_account_idempotent(
        user,
        user,
        asset_mint,
        &spl_token_program_id(),
    );

    let unwrap_ix = build_unwrap_instruction(
        program_id,
        user,
        &vault,
        &vault_config_key,
        &vault_authority_key,
        &asset_cfg,
        &asset_config_key,
        amount,
    )?;

    let tx = build_versioned_tx(rpc, user, vec![create_user_asset_ata, unwrap_ix], None)?;
    bincode::serialize(&tx).map_err(|e| anyhow!("serialize tx: {e}"))
}

#[derive(Debug, serde::Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultAssetView {
    pub mint: String,
    pub free_liquidity: u64,
    pub deployed_to_kamino: u64,
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
    pub mint_haircut_bps: u16,
    pub redemption_haircut_bps: u16,
    pub net_liability: u64,
    pub asset_status: String,
    pub klend_enabled: bool,
}

#[derive(Debug, serde::Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RedeemQuoteView {
    pub input: u64,
    pub output: u64,
    pub haircut_bps: u16,
    pub asset_mint: String,
    pub free_liquidity: u64,
    pub deployed_to_kamino: u64,
    pub redeem_enabled: bool,
}

pub fn redeem_quote(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    asset_mint: &Pubkey,
    amount: u64,
) -> Result<RedeemQuoteView> {
    if amount == 0 {
        return Err(anyhow!("amount must be positive"));
    }
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if !vault.has_asset(asset_mint) {
        return Err(anyhow!("asset not registered: {asset_mint}"));
    }
    let (asset_config_key, cfg) = fetch_asset_config(rpc, program_id, &vault_config_key, asset_mint)?;
    let klend = fetch_klend_config_optional(rpc, program_id, &asset_config_key);
    let free_liquidity = get_token_account_amount(rpc, &cfg.token_vault).unwrap_or(0);
    let output = wrapped_to_underlying_amount(
        amount,
        cfg.token_decimals,
        vault.wrapped_decimals,
        cfg.redemption_haircut_bps,
    )
    .map_err(|e| anyhow!("quote conversion: {e}"))?;
    Ok(RedeemQuoteView {
        input: amount,
        output,
        haircut_bps: cfg.redemption_haircut_bps,
        asset_mint: asset_mint.to_string(),
        free_liquidity,
        deployed_to_kamino: klend
            .as_ref()
            .map(|k| k.total_liquidity_in_klend)
            .unwrap_or(0),
        redeem_enabled: cfg.redeem_allowed(),
    })
}

pub fn fetch_vault_assets(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
) -> Result<Vec<VaultAssetView>> {
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let mut out = Vec::new();
    for mint in vault.registered_assets[..vault.asset_count as usize].iter() {
        if *mint == Pubkey::default() {
            continue;
        }
        let (_, cfg) = fetch_asset_config(rpc, program_id, &vault_config_key, mint)?;
        let (asset_config_key, _) = crate::wrap_stablecoin::pda::asset_config(
            program_id,
            &vault_config_key,
            mint,
        );
        let klend = fetch_klend_config_optional(rpc, program_id, &asset_config_key);
        let free_liquidity = get_token_account_amount(rpc, &cfg.token_vault).unwrap_or(0);
        let net_liability = cfg
            .total_wrapped_minted
            .saturating_sub(cfg.total_redemptions);
        out.push(VaultAssetView {
            mint: mint.to_string(),
            free_liquidity,
            deployed_to_kamino: klend
                .as_ref()
                .map(|k| k.total_liquidity_in_klend)
                .unwrap_or(0),
            mint_enabled: cfg.mint_enabled,
            redeem_enabled: cfg.redeem_enabled,
            mint_haircut_bps: cfg.mint_haircut_bps,
            redemption_haircut_bps: cfg.redemption_haircut_bps,
            net_liability,
            asset_status: asset_status_label(cfg.asset_status),
            klend_enabled: klend.is_some(),
        });
    }
    Ok(out)
}

fn fetch_klend_config_optional(
    rpc: &RpcClient,
    program_id: &Pubkey,
    asset_config: &Pubkey,
) -> Option<KLendConfig> {
    let (key, _) = crate::wrap_stablecoin::pda::klend_config(program_id, asset_config);
    let acc = rpc.get_account(&key).ok()?;
    if acc.data.is_empty() {
        return None;
    }
    let mut data: &[u8] = &acc.data;
    KLendConfig::try_deserialize(&mut data).ok()
}

fn asset_status_label(status: AssetStatus) -> String {
    match status {
        AssetStatus::Active => "active".to_string(),
        AssetStatus::Paused => "paused".to_string(),
        AssetStatus::MintOnly => "mint_only".to_string(),
        AssetStatus::RedeemOnly => "redeem_only".to_string(),
        AssetStatus::Deprecated => "deprecated".to_string(),
    }
}

pub fn decode_versioned_tx_b64(b64: &str) -> Result<VersionedTransaction> {
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| anyhow!("base64: {e}"))?;
    bincode::deserialize(&raw).map_err(|e| anyhow!("bincode vtx: {e}"))
}

fn legacy_keys_and_writable(m: &LegacyMessage) -> (Vec<Pubkey>, Vec<bool>) {
    let keys = m.account_keys.clone();
    let mut writable = vec![false; keys.len()];
    for i in 0..keys.len() {
        writable[i] = is_writable_legacy(m, i);
    }
    (keys, writable)
}

fn v0_keys_and_writable(
    rpc: &RpcClient,
    m: &solana_sdk::message::v0::Message,
) -> Result<(Vec<Pubkey>, Vec<bool>)> {
    let static_len = m.account_keys.len();
    let mut keys = m.account_keys.clone();
    let mut writable = vec![false; static_len];
    let num_signers = m.header.num_required_signatures as usize;
    let num_ro_sign = m.header.num_readonly_signed_accounts as usize;
    let num_ro_un = m.header.num_readonly_unsigned_accounts as usize;
    for i in 0..num_signers.saturating_sub(num_ro_sign) {
        writable[i] = true;
    }
    let num_w_un = static_len.saturating_sub(num_signers + num_ro_sign + num_ro_un);
    let u_start = num_signers + num_ro_sign;
    for i in 0..num_w_un {
        writable[u_start + i] = true;
    }

    for lookup in &m.address_table_lookups {
        let alt_acc = rpc
            .get_account(&lookup.account_key)
            .with_context(|| format!("ALT {}", lookup.account_key))?;
        let alt =
            solana_sdk::address_lookup_table::state::AddressLookupTable::deserialize(&alt_acc.data)
                .map_err(|e| anyhow!("ALT deserialize: {e}"))?;
        for wi in &lookup.writable_indexes {
            let i = *wi as usize;
            if i < alt.addresses.len() {
                keys.push(alt.addresses[i]);
                writable.push(true);
            }
        }
        for ri in &lookup.readonly_indexes {
            let i = *ri as usize;
            if i < alt.addresses.len() {
                keys.push(alt.addresses[i]);
                writable.push(false);
            }
        }
    }
    Ok((keys, writable))
}

pub fn instructions_from_versioned_tx(
    rpc: &RpcClient,
    vtx: &VersionedTransaction,
) -> Result<Vec<Instruction>> {
    let msg = &vtx.message;
    let (keys, writable) = match msg {
        VersionedMessage::Legacy(m) => legacy_keys_and_writable(m),
        VersionedMessage::V0(m) => v0_keys_and_writable(rpc, m)?,
    };
    let num_signers = match msg {
        VersionedMessage::Legacy(m) => m.header.num_required_signatures as usize,
        VersionedMessage::V0(m) => m.header.num_required_signatures as usize,
    };
    let instructions = match msg {
        VersionedMessage::Legacy(m) => &m.instructions[..],
        VersionedMessage::V0(m) => &m.instructions[..],
    };
    let mut out = Vec::new();
    for ci in instructions {
        let prog = keys[ci.program_id_index as usize];
        let mut metas = Vec::new();
        for idx in &ci.accounts {
            let i = *idx as usize;
            let pk = keys
                .get(i)
                .ok_or_else(|| anyhow!("account index {i} OOB"))?;
            let is_signer = i < num_signers;
            let is_writable = *writable.get(i).unwrap_or(&false);
            metas.push(AccountMeta {
                pubkey: *pk,
                is_signer,
                is_writable,
            });
        }
        out.push(Instruction {
            program_id: prog,
            accounts: metas,
            data: ci.data.clone(),
        });
    }
    Ok(out)
}

fn is_writable_legacy(m: &LegacyMessage, idx: usize) -> bool {
    let num_signers = m.header.num_required_signatures as usize;
    let num_ro_signers = m.header.num_readonly_signed_accounts as usize;
    let num_ro_unsigned = m.header.num_readonly_unsigned_accounts as usize;
    let num_writable_unsigned = m
        .account_keys
        .len()
        .saturating_sub(num_signers + num_ro_signers + num_ro_unsigned);
    if idx < num_signers {
        idx < num_signers.saturating_sub(num_ro_signers)
    } else {
        let u_start = num_signers + num_ro_signers;
        idx < u_start + num_writable_unsigned
    }
}
