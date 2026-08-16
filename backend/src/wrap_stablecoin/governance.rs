//! Unsigned txs for vault governance: pause, public flags, allowlist, admin
//! transfer, enable_klend, and mint-authority propose/cancel/accept.

use anyhow::{anyhow, Context, Result};
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;

use super::builder::{build_versioned_tx, fetch_asset_config, fetch_vault_config};
use super::pda::{
    allowlist, asset_config, collateral_vault, klend_config, klend_program_id,
    lending_market_authority, vault_authority,
};

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}

fn serialize_unsigned(
    rpc: &RpcClient,
    payer: &Pubkey,
    instructions: Vec<Instruction>,
) -> Result<Vec<u8>> {
    let tx = build_versioned_tx(rpc, payer, instructions, None)?;
    bincode::serialize(&tx).map_err(|e| anyhow!("serialize tx: {e}"))
}

fn bool_ix_data(name: &str, value: bool) -> Vec<u8> {
    let mut data = anchor_sighash("global", name).to_vec();
    data.push(u8::from(value));
    data
}

fn pubkey_ix_data(name: &str, pubkey: &Pubkey) -> Vec<u8> {
    let mut data = anchor_sighash("global", name).to_vec();
    data.extend_from_slice(pubkey.as_ref());
    data
}

fn empty_ix_data(name: &str) -> Vec<u8> {
    anchor_sighash("global", name).to_vec()
}

fn mint_owner(rpc: &RpcClient, mint: &Pubkey) -> Result<Pubkey> {
    let acc = rpc
        .get_account(mint)
        .with_context(|| format!("mint {mint}"))?;
    Ok(acc.owner)
}

fn admin_vault_accounts(admin: &Pubkey, vault_config_key: &Pubkey) -> Vec<AccountMeta> {
    vec![
        AccountMeta::new(*admin, true),
        AccountMeta::new(*vault_config_key, false),
    ]
}

pub fn unsigned_set_paused_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    paused: bool,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: admin_vault_accounts(admin, &vault_config_key),
        data: bool_ix_data("set_paused", paused),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_set_wrap_public_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    wrap_public: bool,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: admin_vault_accounts(admin, &vault_config_key),
        data: bool_ix_data("set_wrap_public", wrap_public),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_set_unwrap_public_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    unwrap_public: bool,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: admin_vault_accounts(admin, &vault_config_key),
        data: bool_ix_data("set_unwrap_public", unwrap_public),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_init_allowlist_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let (allowlist_key, _) = allowlist(program_id, &vault_config_key);
    if let Ok(acc) = rpc.get_account(&allowlist_key) {
        if !acc.data.is_empty() {
            return Err(anyhow!("allowlist already initialized"));
        }
    }
    let ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(vault_config_key, false),
            AccountMeta::new(allowlist_key, false),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ],
        data: empty_ix_data("init_allowlist"),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

fn allowlist_member_ix(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    allowlist_key: &Pubkey,
    name: &str,
    member: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(*vault_config_key, false),
            AccountMeta::new(*allowlist_key, false),
        ],
        data: pubkey_ix_data(name, member),
    }
}

pub fn unsigned_add_to_allowlist_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    member: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let (allowlist_key, _) = allowlist(program_id, &vault_config_key);
    let ix = allowlist_member_ix(
        program_id,
        admin,
        &vault_config_key,
        &allowlist_key,
        "add_to_allowlist",
        member,
    );
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_remove_from_allowlist_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    member: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let (allowlist_key, _) = allowlist(program_id, &vault_config_key);
    let ix = allowlist_member_ix(
        program_id,
        admin,
        &vault_config_key,
        &allowlist_key,
        "remove_from_allowlist",
        member,
    );
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_transfer_authority_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    new_admin: &Pubkey,
) -> Result<Vec<u8>> {
    if *new_admin == Pubkey::default() {
        return Err(anyhow!("newAdmin must not be the default pubkey"));
    }
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(vault_config_key, false),
            AccountMeta::new_readonly(*new_admin, false),
        ],
        data: empty_ix_data("transfer_authority"),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_cancel_transfer_authority_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: admin_vault_accounts(admin, &vault_config_key),
        data: empty_ix_data("cancel_transfer_authority"),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_accept_authority_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if vault.pending_admin == Pubkey::default() {
        return Err(anyhow!("no pending admin transfer"));
    }
    let new_admin = vault.pending_admin;
    let ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(new_admin, true),
            AccountMeta::new(vault_config_key, false),
        ],
        data: empty_ix_data("accept_authority"),
    };
    serialize_unsigned(rpc, &new_admin, vec![ix])
}

pub fn unsigned_enable_klend_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    asset_mint: &Pubkey,
    lending_market: &Pubkey,
    reserve: &Pubkey,
    reserve_liquidity_supply: &Pubkey,
    collateral_mint: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if !vault.has_asset(asset_mint) {
        return Err(anyhow!("asset not registered: {asset_mint}"));
    }
    let (asset_config_key, _) =
        fetch_asset_config(rpc, program_id, &vault_config_key, asset_mint)?;
    let (klend_config_key, _) = klend_config(program_id, &asset_config_key);
    if let Ok(acc) = rpc.get_account(&klend_config_key) {
        if !acc.data.is_empty() {
            return Err(anyhow!("KLend already enabled for this asset"));
        }
    }
    let (vault_authority_key, _) = vault_authority(program_id, &vault_config_key);
    let klend_program = klend_program_id();
    let (lending_market_authority_key, _) =
        lending_market_authority(&klend_program, lending_market);
    let (collateral_vault_key, _) = collateral_vault(program_id, &asset_config_key);
    let collateral_token_program = mint_owner(rpc, collateral_mint)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new_readonly(vault_config_key, false),
            AccountMeta::new_readonly(vault_authority_key, false),
            AccountMeta::new_readonly(asset_config_key, false),
            AccountMeta::new(klend_config_key, false),
            AccountMeta::new_readonly(*lending_market, false),
            AccountMeta::new_readonly(lending_market_authority_key, false),
            AccountMeta::new_readonly(*reserve, false),
            AccountMeta::new_readonly(*reserve_liquidity_supply, false),
            AccountMeta::new_readonly(*collateral_mint, false),
            AccountMeta::new(collateral_vault_key, false),
            AccountMeta::new_readonly(collateral_token_program, false),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ],
        data: empty_ix_data("enable_klend"),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_propose_mint_authority_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
    new_mint_authority: &Pubkey,
) -> Result<Vec<u8>> {
    if *new_mint_authority == Pubkey::default() {
        return Err(anyhow!(
            "newMintAuthority must not be the default pubkey"
        ));
    }
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if vault.mint_authority_transferred {
        return Err(anyhow!("mint authority already transferred"));
    }
    let ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(vault_config_key, false),
            AccountMeta::new_readonly(*new_mint_authority, false),
        ],
        data: empty_ix_data("propose_mint_authority"),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_cancel_propose_mint_authority_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
    admin: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, _) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    let ix = Instruction {
        program_id: *program_id,
        accounts: admin_vault_accounts(admin, &vault_config_key),
        data: empty_ix_data("cancel_propose_mint_authority"),
    };
    serialize_unsigned(rpc, admin, vec![ix])
}

pub fn unsigned_accept_mint_authority_tx_bytes(
    rpc: &RpcClient,
    program_id: &Pubkey,
    vault_authority_seed: &Pubkey,
) -> Result<Vec<u8>> {
    let (vault_config_key, vault) = fetch_vault_config(rpc, program_id, vault_authority_seed)?;
    if vault.mint_authority_transferred {
        return Err(anyhow!("mint authority already transferred"));
    }
    if vault.pending_mint_authority == Pubkey::default() {
        return Err(anyhow!("no pending mint authority transfer"));
    }
    let new_mint_authority = vault.pending_mint_authority;
    let (vault_authority_key, _) = vault_authority(program_id, &vault_config_key);
    let token_program = mint_owner(rpc, &vault.wrapped_mint)?;
    let mut accounts = vec![
        AccountMeta::new(new_mint_authority, true),
        AccountMeta::new(vault_config_key, false),
        AccountMeta::new(vault.wrapped_mint, false),
        AccountMeta::new_readonly(vault_authority_key, false),
        AccountMeta::new_readonly(token_program, false),
    ];
    for mint in vault.registered_assets[..vault.asset_count as usize].iter() {
        let (asset_config_key, _) = asset_config(program_id, &vault_config_key, mint);
        accounts.push(AccountMeta::new(asset_config_key, false));
    }
    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data: empty_ix_data("accept_mint_authority"),
    };
    serialize_unsigned(rpc, &new_mint_authority, vec![ix])
}
