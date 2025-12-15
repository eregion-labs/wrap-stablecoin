use anchor_client::{
    solana_sdk::{
        commitment_config::CommitmentConfig,
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair, Signer},
        system_program, sysvar, transaction::Transaction,
    },
    Cluster,
};
use anchor_lang::prelude::AnchorSerialize;
use anyhow::Result;
use sha2::{Digest, Sha256};
use anchor_client::solana_client::rpc_client::RpcClient;

const KLEND_PROGRAM_ID: &str = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
const LENDING_MARKET_SIZE: usize = 4656;
const LENDING_MARKET_AUTH_SEED: &[u8] = b"lma";
const ACCOUNT_DISCRIMINATOR_LEN: usize = 8;
const LENDING_MARKET_SPACE: usize = LENDING_MARKET_SIZE + ACCOUNT_DISCRIMINATOR_LEN;

#[test]
fn initialize_klend_market() -> Result<()> {
    let anchor_wallet_env = std::env::var("ANCHOR_WALLET").ok();
    let wallet_path = shellexpand::tilde(
        anchor_wallet_env
            .as_deref()
            .unwrap_or("~/.config/solana/id.json"),
    );
    let payer = read_keypair_file(wallet_path.to_string())
        .map_err(|err| anyhow::anyhow!(err.to_string()))?;

    let rpc_url = std::env::var("ANCHOR_PROVIDER_URL")
        .unwrap_or_else(|_| Cluster::Localnet.url().to_string());
    let rpc = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::processed());
    eprintln!("Using RPC {}", rpc.url());
    let program_id: Pubkey = KLEND_PROGRAM_ID.parse()?;

    // Confirm program is loaded before continuing.
    let program_account = rpc.get_account(&program_id)?;
    assert!(
        program_account.executable,
        "klend program account is not executable"
    );

    let lending_market = Keypair::new();
    let (lending_market_authority, _) = Pubkey::find_program_address(
        &[LENDING_MARKET_AUTH_SEED, lending_market.pubkey().as_ref()],
        &program_id,
    );

    let mut quote_currency = [0u8; 32];
    quote_currency[..3].copy_from_slice(b"USD");

    let rent_lamports = rpc.get_minimum_balance_for_rent_exemption(LENDING_MARKET_SPACE)?;
    let create_account_ix = anchor_client::solana_sdk::system_instruction::create_account(
        &payer.pubkey(),
        &lending_market.pubkey(),
        rent_lamports,
        LENDING_MARKET_SPACE as u64,
        &program_id,
    );

    let init_ix = init_lending_market_ix(
        program_id,
        quote_currency,
        &payer.pubkey(),
        &lending_market.pubkey(),
        &lending_market_authority,
    )?;

    let recent_blockhash = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[create_account_ix, init_ix],
        Some(&payer.pubkey()),
        &[&payer, &lending_market],
        recent_blockhash,
    );

    let signature = rpc.send_and_confirm_transaction(&tx)?;
    println!("Initialized lending market with tx {}", signature);

    Ok(())
}

#[derive(AnchorSerialize)]
struct InitLendingMarketArgs {
    quote_currency: [u8; 32],
}

fn init_lending_market_ix(
    program_id: Pubkey,
    quote_currency: [u8; 32],
    payer: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "init_lending_market").to_vec();
    data.extend(InitLendingMarketArgs { quote_currency }.try_to_vec()?);

    let accounts = vec![
        AccountMeta::new(*payer, true),
        AccountMeta::new(*lending_market, false),
        AccountMeta::new_readonly(*lending_market_authority, false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new_readonly(sysvar::rent::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}
