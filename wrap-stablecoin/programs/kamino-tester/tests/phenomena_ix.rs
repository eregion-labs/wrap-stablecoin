//! Instruction builders for KLend and wrapped token program.
//! Shared by phenomena_test and other tests that need wrap/unwrap.

use anchor_lang::prelude::AnchorSerialize;
use sha2::{Digest, Sha256};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
};

const LENDING_MARKET_SPACE: usize = 4656 + 8;
const RESERVE_SPACE: usize = 8616 + 8;
const LENDING_MARKET_AUTH_SEED: &[u8] = b"lma";
const RESERVE_LIQ_SUPPLY_SEED: &[u8] = b"reserve_liq_supply";
const FEE_RECEIVER_SEED: &[u8] = b"fee_receiver";
const RESERVE_COLL_MINT_SEED: &[u8] = b"reserve_coll_mint";
const RESERVE_COLL_SUPPLY_SEED: &[u8] = b"reserve_coll_supply";

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}

// ============================================================================
// KLend
// ============================================================================

#[derive(AnchorSerialize)]
struct InitLendingMarketArgs {
    quote_currency: [u8; 32],
}

pub fn init_lending_market_ix(
    program_id: Pubkey,
    quote_currency: [u8; 32],
    payer: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
) -> Instruction {
    let mut data = anchor_sighash("global", "init_lending_market").to_vec();
    data.extend(
        InitLendingMarketArgs { quote_currency }
            .try_to_vec()
            .unwrap(),
    );

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(*lending_market, false),
            AccountMeta::new_readonly(*lending_market_authority, false),
            AccountMeta::new_readonly(system_program::id(), false),
            AccountMeta::new_readonly(solana_sdk::sysvar::rent::id(), false),
        ],
        data,
    }
}

pub fn init_reserve_ix(
    program_id: Pubkey,
    signer: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
    reserve: &Pubkey,
    reserve_liquidity_mint: &Pubkey,
    reserve_liquidity_supply: &Pubkey,
    fee_receiver: &Pubkey,
    reserve_collateral_mint: &Pubkey,
    reserve_collateral_supply: &Pubkey,
    initial_liquidity_source: &Pubkey,
) -> Instruction {
    let data = anchor_sighash("global", "init_reserve").to_vec();

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(*signer, true),
            AccountMeta::new(*lending_market, false),
            AccountMeta::new_readonly(*lending_market_authority, false),
            AccountMeta::new(*reserve, false),
            AccountMeta::new_readonly(*reserve_liquidity_mint, false),
            AccountMeta::new(*reserve_liquidity_supply, false),
            AccountMeta::new(*fee_receiver, false),
            AccountMeta::new(*reserve_collateral_mint, false),
            AccountMeta::new(*reserve_collateral_supply, false),
            AccountMeta::new(*initial_liquidity_source, false),
            AccountMeta::new_readonly(solana_sdk::sysvar::rent::id(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

pub fn derive_klend_pdas(
    reserve: &Pubkey,
    klend_program_id: &Pubkey,
) -> (Pubkey, Pubkey, Pubkey, Pubkey) {
    let reserve_liquidity_supply = Pubkey::find_program_address(
        &[RESERVE_LIQ_SUPPLY_SEED, reserve.as_ref()],
        klend_program_id,
    )
    .0;
    let fee_receiver =
        Pubkey::find_program_address(&[FEE_RECEIVER_SEED, reserve.as_ref()], klend_program_id).0;
    let collateral_mint = Pubkey::find_program_address(
        &[RESERVE_COLL_MINT_SEED, reserve.as_ref()],
        klend_program_id,
    )
    .0;
    let reserve_collateral_supply = Pubkey::find_program_address(
        &[RESERVE_COLL_SUPPLY_SEED, reserve.as_ref()],
        klend_program_id,
    )
    .0;
    (
        reserve_liquidity_supply,
        fee_receiver,
        collateral_mint,
        reserve_collateral_supply,
    )
}

pub const LENDING_MARKET_SPACE_BYTES: usize = LENDING_MARKET_SPACE;
pub const RESERVE_SPACE_BYTES: usize = RESERVE_SPACE;
pub const LENDING_MARKET_AUTH_SEED_BYTES: &[u8] = LENDING_MARKET_AUTH_SEED;

// ============================================================================
// Wrapped Token Program
// ============================================================================

pub fn wrapped_initialize_ix(
    program_id: Pubkey,
    authority: &Pubkey,
    usdc_mint: &Pubkey,
    vault_config: &Pubkey,
    wrapped_mint: &Pubkey,
    vault_authority: &Pubkey,
    lending_market: &Pubkey,
    treasury: &Pubkey,
    reserve: &Pubkey,
    collateral_mint: &Pubkey,
    token_config: &Pubkey,
    collateral_vault: &Pubkey,
    token_vault: &Pubkey,
) -> Instruction {
    let data = anchor_sighash("global", "initialize").to_vec();

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(*usdc_mint, false),
            AccountMeta::new(*vault_config, false),
            AccountMeta::new(*wrapped_mint, false),
            AccountMeta::new_readonly(*vault_authority, false),
            AccountMeta::new_readonly(*lending_market, false),
            AccountMeta::new_readonly(*treasury, false),
            AccountMeta::new_readonly(*reserve, false),
            AccountMeta::new_readonly(*collateral_mint, false),
            AccountMeta::new(*token_config, false),
            AccountMeta::new(*collateral_vault, false),
            AccountMeta::new(*token_vault, false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

#[derive(AnchorSerialize)]
struct WrapArgs {
    amount: u64,
}

pub fn wrapped_wrap_ix(
    program_id: Pubkey,
    user: &Pubkey,
    vault_config: &Pubkey,
    vault_authority: &Pubkey,
    token_config: &Pubkey,
    token_mint: &Pubkey,
    user_token: &Pubkey,
    user_wrapped: &Pubkey,
    wrapped_mint: &Pubkey,
    token_vault: &Pubkey,
    usdc_mint: &Pubkey,
    allowlist: Option<&Pubkey>,
    amount: u64,
) -> Instruction {
    let mut data = anchor_sighash("global", "wrap").to_vec();
    data.extend(WrapArgs { amount }.try_to_vec().unwrap());

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(*user, true),
            AccountMeta::new(*vault_config, false),
            AccountMeta::new_readonly(*vault_authority, false),
            AccountMeta::new(*token_config, false),
            AccountMeta::new_readonly(*token_mint, false),
            AccountMeta::new(*user_token, false),
            AccountMeta::new(*user_wrapped, false),
            AccountMeta::new(*wrapped_mint, false),
            AccountMeta::new(*token_vault, false),
            AccountMeta::new_readonly(*usdc_mint, false),
            AccountMeta::new_readonly(*allowlist.unwrap_or(&program_id), false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data,
    }
}

#[derive(AnchorSerialize)]
struct UnwrapArgs {
    amount: u64,
}

pub fn wrapped_unwrap_ix(
    program_id: Pubkey,
    user: &Pubkey,
    vault_config: &Pubkey,
    vault_authority: &Pubkey,
    user_wrapped: &Pubkey,
    user_base_token: &Pubkey,
    wrapped_mint: &Pubkey,
    usdc_mint: &Pubkey,
    base_token_config: &Pubkey,
    base_token_vault: &Pubkey,
    allowlist: Option<&Pubkey>,
    amount: u64,
) -> Instruction {
    let mut data = anchor_sighash("global", "unwrap").to_vec();
    data.extend(UnwrapArgs { amount }.try_to_vec().unwrap());

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(*user, true),
            AccountMeta::new(*vault_config, false),
            AccountMeta::new_readonly(*vault_authority, false),
            AccountMeta::new(*user_wrapped, false),
            AccountMeta::new(*user_base_token, false),
            AccountMeta::new(*wrapped_mint, false),
            AccountMeta::new_readonly(*usdc_mint, false),
            AccountMeta::new(*base_token_config, false),
            AccountMeta::new(*base_token_vault, false),
            AccountMeta::new_readonly(*allowlist.unwrap_or(&program_id), false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data,
    }
}
