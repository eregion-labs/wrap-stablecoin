//! KLend CPI account resolution and `refresh_reserve` prefix for admin txs.

use std::collections::HashMap;
use std::str::FromStr;

use anyhow::{anyhow, Context, Result};
use anchor_lang::{AccountDeserialize, AnchorSerialize};
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use wrap_stablecoin::state::{AssetConfig, KLendConfig};
use wrap_stablecoin::{
    DepositToKlendArgs, HarvestYieldArgs, SweepHomeSurplusArgs, WithdrawFromKlendArgs,
    WithdrawTreasuryArgs,
};

use super::pda::{
    collateral_vault, klend_config, klend_program_id, lending_market_authority, treasury_vault,
};

/// Mainnet / localnet-cloned Kamino USDC reserve → Scope oracle (fixtures/klend).
const DEFAULT_USDC_RESERVE: &str = "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
const DEFAULT_USDC_SCOPE_PRICES: &str = "3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH";

const ENV_SCOPE_PREFIX: &str = "KLEND_SCOPE_PRICES_";

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}

/// Load `KLEND_SCOPE_PRICES_<reserve>=<oracle>` env vars, plus the known USDC default.
pub fn load_klend_scope_prices_from_env() -> HashMap<Pubkey, Pubkey> {
    let mut map = HashMap::new();
    if let (Ok(reserve), Ok(oracle)) = (
        Pubkey::from_str(DEFAULT_USDC_RESERVE),
        Pubkey::from_str(DEFAULT_USDC_SCOPE_PRICES),
    ) {
        map.insert(reserve, oracle);
    }
    for (key, value) in std::env::vars() {
        let Some(reserve_str) = key.strip_prefix(ENV_SCOPE_PREFIX) else {
            continue;
        };
        let Ok(reserve) = Pubkey::from_str(reserve_str.trim()) else {
            continue;
        };
        let Ok(oracle) = Pubkey::from_str(value.trim()) else {
            continue;
        };
        map.insert(reserve, oracle);
    }
    map
}

pub fn scope_prices_for_reserve(
    map: &HashMap<Pubkey, Pubkey>,
    reserve: &Pubkey,
) -> Result<Pubkey> {
    map.get(reserve).copied().ok_or_else(|| {
        anyhow!(
            "missing Scope oracle for KLend reserve {reserve}; set {ENV_SCOPE_PREFIX}{reserve}=<scope_prices pubkey>"
        )
    })
}

pub struct KlendCpiAccounts {
    pub klend_config_key: Pubkey,
    pub klend: KLendConfig,
    pub lending_market_authority: Pubkey,
    pub collateral_vault: Pubkey,
    pub token_program: Pubkey,
    pub collateral_token_program: Pubkey,
}

pub fn fetch_klend_config_required(
    rpc: &RpcClient,
    program_id: &Pubkey,
    asset_config: &Pubkey,
) -> Result<(Pubkey, KLendConfig)> {
    let (key, _) = klend_config(program_id, asset_config);
    let acc = rpc
        .get_account(&key)
        .with_context(|| format!("klend_config {key} (KLend not enabled for this asset)"))?;
    if acc.data.is_empty() {
        return Err(anyhow!("KLend not enabled for this asset"));
    }
    let mut data: &[u8] = &acc.data;
    let cfg = KLendConfig::try_deserialize(&mut data)
        .map_err(|e| anyhow!("klend_config decode: {e}"))?;
    Ok((key, cfg))
}

fn mint_owner(rpc: &RpcClient, mint: &Pubkey) -> Result<Pubkey> {
    let acc = rpc
        .get_account(mint)
        .with_context(|| format!("mint {mint}"))?;
    Ok(acc.owner)
}

pub fn resolve_klend_cpi_accounts(
    rpc: &RpcClient,
    program_id: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
) -> Result<KlendCpiAccounts> {
    let (klend_config_key, klend) =
        fetch_klend_config_required(rpc, program_id, asset_config_key)?;
    let klend_program = klend_program_id();
    let (lending_market_authority, _) =
        lending_market_authority(&klend_program, &klend.lending_market);
    let (collateral_vault_key, _) = collateral_vault(program_id, asset_config_key);
    let token_program = mint_owner(rpc, &asset_cfg.token_mint)?;
    let collateral_token_program = mint_owner(rpc, &klend.collateral_mint)?;
    Ok(KlendCpiAccounts {
        klend_config_key,
        klend,
        lending_market_authority,
        collateral_vault: collateral_vault_key,
        token_program,
        collateral_token_program,
    })
}

/// KLend `refresh_reserve` — must precede deposit / withdraw / harvest in the same tx.
pub fn build_refresh_reserve_ix(
    reserve: &Pubkey,
    lending_market: &Pubkey,
    scope_prices: &Pubkey,
) -> Instruction {
    let klend_program = klend_program_id();
    let none = klend_program;
    Instruction {
        program_id: klend_program,
        accounts: vec![
            AccountMeta::new(*reserve, false),
            AccountMeta::new_readonly(*lending_market, false),
            AccountMeta::new_readonly(none, false),
            AccountMeta::new_readonly(none, false),
            AccountMeta::new_readonly(none, false),
            AccountMeta::new_readonly(*scope_prices, false),
        ],
        data: anchor_sighash("global", "refresh_reserve").to_vec(),
    }
}

fn instruction_sysvar() -> Pubkey {
    solana_sdk::sysvar::instructions::id()
}

fn klend_deposit_withdraw_accounts(
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    cpi: &KlendCpiAccounts,
    klend_config_writable: bool,
) -> Vec<AccountMeta> {
    let klend_config_meta = if klend_config_writable {
        AccountMeta::new(cpi.klend_config_key, false)
    } else {
        AccountMeta::new_readonly(cpi.klend_config_key, false)
    };
    vec![
        AccountMeta::new(*admin, true),
        AccountMeta::new_readonly(*vault_config_key, false),
        AccountMeta::new_readonly(*vault_authority_key, false),
        AccountMeta::new_readonly(*asset_config_key, false),
        klend_config_meta,
        AccountMeta::new(asset_cfg.token_vault, false),
        AccountMeta::new_readonly(asset_cfg.token_mint, false),
        AccountMeta::new_readonly(klend_program_id(), false),
        AccountMeta::new_readonly(cpi.klend.lending_market, false),
        AccountMeta::new_readonly(cpi.lending_market_authority, false),
        AccountMeta::new(cpi.klend.reserve, false),
        AccountMeta::new(cpi.klend.reserve_liquidity_supply, false),
        AccountMeta::new(cpi.klend.collateral_mint, false),
        AccountMeta::new(cpi.collateral_vault, false),
        AccountMeta::new_readonly(cpi.token_program, false),
        AccountMeta::new_readonly(cpi.collateral_token_program, false),
        AccountMeta::new_readonly(instruction_sysvar(), false),
    ]
}

pub fn build_deposit_to_klend_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    cpi: &KlendCpiAccounts,
    amount: u64,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "deposit_to_klend").to_vec();
    data.extend(
        DepositToKlendArgs { amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh deposit_to_klend args: {e}"))?,
    );
    Ok(Instruction {
        program_id: *program_id,
        accounts: klend_deposit_withdraw_accounts(
            admin,
            vault_config_key,
            vault_authority_key,
            asset_config_key,
            asset_cfg,
            cpi,
            true,
        ),
        data,
    })
}

pub fn build_deposit_all_to_klend_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    cpi: &KlendCpiAccounts,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: klend_deposit_withdraw_accounts(
            admin,
            vault_config_key,
            vault_authority_key,
            asset_config_key,
            asset_cfg,
            cpi,
            true,
        ),
        data: anchor_sighash("global", "deposit_all_to_klend").to_vec(),
    }
}

pub fn build_withdraw_from_klend_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    cpi: &KlendCpiAccounts,
    collateral_amount: u64,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "withdraw_from_klend").to_vec();
    data.extend(
        WithdrawFromKlendArgs { collateral_amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh withdraw_from_klend args: {e}"))?,
    );
    Ok(Instruction {
        program_id: *program_id,
        accounts: klend_deposit_withdraw_accounts(
            admin,
            vault_config_key,
            vault_authority_key,
            asset_config_key,
            asset_cfg,
            cpi,
            true,
        ),
        data,
    })
}

pub fn build_withdraw_all_from_klend_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    cpi: &KlendCpiAccounts,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: klend_deposit_withdraw_accounts(
            admin,
            vault_config_key,
            vault_authority_key,
            asset_config_key,
            asset_cfg,
            cpi,
            true,
        ),
        data: anchor_sighash("global", "withdraw_all_from_klend").to_vec(),
    }
}

pub fn build_harvest_yield_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    cpi: &KlendCpiAccounts,
    collateral_amount: u64,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "harvest_yield").to_vec();
    data.extend(
        HarvestYieldArgs { collateral_amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh harvest_yield args: {e}"))?,
    );
    let (treasury_key, _) = treasury_vault(program_id, asset_config_key);
    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new_readonly(*vault_config_key, false),
            AccountMeta::new_readonly(*vault_authority_key, false),
            AccountMeta::new_readonly(*asset_config_key, false),
            AccountMeta::new_readonly(cpi.klend_config_key, false),
            AccountMeta::new_readonly(asset_cfg.token_mint, false),
            AccountMeta::new(treasury_key, false),
            AccountMeta::new(cpi.collateral_vault, false),
            AccountMeta::new_readonly(klend_program_id(), false),
            AccountMeta::new_readonly(cpi.klend.lending_market, false),
            AccountMeta::new_readonly(cpi.lending_market_authority, false),
            AccountMeta::new(cpi.klend.reserve, false),
            AccountMeta::new(cpi.klend.reserve_liquidity_supply, false),
            AccountMeta::new(cpi.klend.collateral_mint, false),
            AccountMeta::new_readonly(cpi.token_program, false),
            AccountMeta::new_readonly(cpi.collateral_token_program, false),
            AccountMeta::new_readonly(instruction_sysvar(), false),
        ],
        data,
    })
}

pub fn build_sweep_home_surplus_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    amount: u64,
    token_program: &Pubkey,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "sweep_home_surplus").to_vec();
    data.extend(
        SweepHomeSurplusArgs { amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh sweep_home_surplus args: {e}"))?,
    );
    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new_readonly(*vault_config_key, false),
            AccountMeta::new_readonly(*vault_authority_key, false),
            AccountMeta::new(*asset_config_key, false),
            AccountMeta::new_readonly(asset_cfg.token_mint, false),
            AccountMeta::new(asset_cfg.token_vault, false),
            AccountMeta::new(asset_cfg.treasury_vault, false),
            AccountMeta::new_readonly(*token_program, false),
        ],
        data,
    })
}

pub fn build_withdraw_treasury_instruction(
    program_id: &Pubkey,
    admin: &Pubkey,
    vault_config_key: &Pubkey,
    vault_authority_key: &Pubkey,
    asset_config_key: &Pubkey,
    asset_cfg: &AssetConfig,
    destination: &Pubkey,
    amount: u64,
    token_program: &Pubkey,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "withdraw_treasury").to_vec();
    data.extend(
        WithdrawTreasuryArgs { amount }
            .try_to_vec()
            .map_err(|e| anyhow!("borsh withdraw_treasury args: {e}"))?,
    );
    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new_readonly(*vault_config_key, false),
            AccountMeta::new_readonly(*vault_authority_key, false),
            AccountMeta::new_readonly(*asset_config_key, false),
            AccountMeta::new_readonly(asset_cfg.token_mint, false),
            AccountMeta::new(asset_cfg.treasury_vault, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*token_program, false),
        ],
        data,
    })
}
