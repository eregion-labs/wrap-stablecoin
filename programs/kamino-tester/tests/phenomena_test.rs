use anchor_client::{solana_sdk::commitment_config::CommitmentConfig, Client, Cluster};
use anchor_client::solana_sdk::{pubkey::Pubkey, signature::read_keypair_file};
use solana_sdk::signature::{Keypair, Signer};
use std::collections::HashMap;

pub mod utils;
use utils::{airdrop_sol_to_users, setup_token_mint, setup_token_mint_ata_and_mint_to_many_users};

const USDC_LAMPORTS_PER_USDC: u64 = 1_000_000; // 6 decimals

#[test]
fn test_setup() {
    const KLEND_PROGRAM_ID: &str = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
    const WRAPPED_TOKEN_PROGRAM_ID: &str = "5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT";

    let anchor_wallet = std::env::var("ANCHOR_WALLET").unwrap();
    let payer = read_keypair_file(&anchor_wallet).unwrap();
    let mint_authority = &payer;

    let user_1 = Keypair::new();
    let user_2 = Keypair::new();
    let user_3 = Keypair::new();

    let client = Client::new_with_options(Cluster::Localnet, &payer, CommitmentConfig::confirmed());

    let wrapped_token_program = client
        .program(WRAPPED_TOKEN_PROGRAM_ID.parse().unwrap())
        .unwrap();
    let _kamino_program = client.program(KLEND_PROGRAM_ID.parse().unwrap()).unwrap();
    let rpc = wrapped_token_program.rpc();

    let usdc_mint = Keypair::new();
    let stablecoin_mint = Keypair::new();

    let everyone = HashMap::from([
        (payer.pubkey(), "payer".to_string()),
        (user_1.pubkey(), "user_1".to_string()),
        (user_2.pubkey(), "user_2".to_string()),
        (user_3.pubkey(), "user_3".to_string()),
    ]);

    airdrop_sol_to_users(&rpc, &everyone);

    setup_token_mint(&rpc, &payer, &payer, &usdc_mint, 6).unwrap();
    setup_token_mint(&rpc, &payer, &payer, &stablecoin_mint, 6).unwrap();

    let users: Vec<Pubkey> = everyone.keys().cloned().collect();

    let _usdc_atas = setup_token_mint_ata_and_mint_to_many_users(
        &rpc,
        &payer,
        mint_authority,
        &users,
        &usdc_mint,
        1_000_000_000 * USDC_LAMPORTS_PER_USDC,
        "USDC",
    )
    .unwrap();

    let _stablecoin_atas = setup_token_mint_ata_and_mint_to_many_users(
        &rpc,
        &payer,
        mint_authority,
        &users,
        &stablecoin_mint,
        1_000_000_000 * USDC_LAMPORTS_PER_USDC,
        "Stablecoin",
    )
    .unwrap();

    println!("\n\n");
    println!(" 🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪");
    println!(" 🟪 🟪 🟪 🟪 GOD LOVES ME 🟪 🟪 🟪 🟪");
    println!(" 🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪🟪");
}
