use std::collections::HashMap;

use anchor_client::anchor_lang::solana_program::example_mocks::solana_sdk::system_instruction;
use anchor_client::Program;
use anchor_spl::associated_token::spl_associated_token_account::instruction::create_associated_token_account;
use anchor_spl::{
    associated_token::spl_associated_token_account::{self},
    token::spl_token,
};

use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::{
    instruction::Instruction,
    message::{v0::Message, VersionedMessage},
    native_token::LAMPORTS_PER_SOL,
    program_pack::Pack,
    signature::{Keypair, Signature},
    signers::Signers,
    transaction::VersionedTransaction,
};
use solana_sdk::{pubkey::Pubkey, signer::Signer};

/// Generate a unique post_id_hash for creating posts.
/// Uses current time (nanoseconds) + creator pubkey to ensure uniqueness.
/// If parent_post_pda is provided, also incorporates it for child post uniqueness.
use rand::RngCore;

pub async fn current_chain_timestamp(rpc: &RpcClient) -> i64 {
    let slot = rpc.get_slot().await.unwrap();
    rpc.get_block_time(slot).await.unwrap()
}
pub async fn wait_for_seconds(seconds: u64) {
    println!("⏳ Waiting {} seconds…", seconds);
    tokio::time::sleep(tokio::time::Duration::from_secs(seconds)).await;
}

pub async fn setup_token_mint(
    rpc: &RpcClient,
    payer: &Keypair,
    mint_authority: &Keypair,
    _program: &Program<&Keypair>,
    token_mint: &Keypair,
    decimals: u8,
) -> Pubkey {
    let space = spl_token::state::Mint::LEN;
    let rent = rpc
        .get_minimum_balance_for_rent_exemption(space)
        .await
        .unwrap();
    // initialize jitosol_mint
    let create_token_mint_ix = system_instruction::create_account(
        &mint_authority.pubkey(),
        &token_mint.pubkey(),
        rent,
        spl_token::state::Mint::LEN as u64,
        &spl_token::ID,
    );
    println!("🌟 create_token_mint_ix: {:?}", create_token_mint_ix);

    // initialize jitosol_mint
    let initialize_token_mint_ix = spl_token::instruction::initialize_mint2(
        &spl_token::ID,
        &token_mint.pubkey(),
        &mint_authority.pubkey(),
        None,
        decimals,
    )
    .unwrap();
    println!(
        "🌟 initialize_token_mint_ix: {:?}",
        initialize_token_mint_ix
    );
    let token_setup_tx = send_tx(
        &rpc,
        vec![create_token_mint_ix, initialize_token_mint_ix],
        &payer.pubkey(),
        &[&payer, &token_mint],
    )
    .await
    .unwrap();
    println!("🌟{:} setup tx: {:}", token_mint.pubkey(), token_setup_tx);
    mint_authority.pubkey()
}

pub async fn setup_token_mint_ata_and_mint_to(
    rpc: &RpcClient,
    payer: &Keypair,
    mint_authority: &Keypair,
    mint_to: &Pubkey,
    program: &Program<&Keypair>,
    token_mint: &Keypair,
    amount: u64,
    bling_mint: &Keypair,
    usdc_mint: &Keypair,
    stablecoin_mint: &Keypair,
) -> Pubkey {
    let token_name = match token_mint.pubkey() {
        pk if pk == bling_mint.pubkey() => "Bling",
        pk if pk == usdc_mint.pubkey() => "USDC",
        pk if pk == stablecoin_mint.pubkey() => "Stablecoin",
        _ => "Unknown",
    };
    let user_token_ata = spl_associated_token_account::get_associated_token_address(
        &mint_to,
        &token_mint.pubkey().clone(),
    );

    let ata_already_exists = rpc.get_account(&user_token_ata).await.is_ok();
    // Check if ATA already exists
    if ata_already_exists {
        println!("🔁 ATA {} already exists, reusing", user_token_ata);
    } else {
        // Create the ATA first
        let create_ata_ix = create_associated_token_account(
            &payer.pubkey(),
            &mint_to,
            &token_mint.pubkey().clone(),
            &spl_token::ID,
        );
        println!("🌟 create_ata_ix: {:?}", create_ata_ix);
        let user_token_ata = spl_associated_token_account::get_associated_token_address(
            &mint_to,
            &token_mint.pubkey().clone(),
        );
        println!("🌟 user_token_ata: {:?}", user_token_ata);

        let token_setup_tx = send_tx(
            &rpc,
            vec![
                // create_token_mint_ix,
                // initialize_token_mint_ix,
                create_ata_ix,
            ],
            &payer.pubkey(),
            &[&payer],
        )
        .await
        .unwrap();

        println!("🌟{:} setup tx: {:}", token_name, token_setup_tx);
    }

    // mint a big balance to the user
    let mint_token_to_user_ix = spl_token::instruction::mint_to(
        &spl_token::ID,
        &token_mint.pubkey().clone(),
        &user_token_ata,
        &mint_authority.pubkey(),
        &[&mint_authority.pubkey()],
        amount,
    )
    .unwrap();

    println!("🌟 mint_token_to_user_ix: {:?}", mint_token_to_user_ix);
    let token_mint_tx = send_tx(
        &rpc,
        vec![mint_token_to_user_ix],
        &payer.pubkey(),
        &[&mint_authority],
    )
    .await
    .unwrap();

    let user_token_balance = program
        .account::<anchor_spl::token::TokenAccount>(user_token_ata)
        .await
        .unwrap();
    if !ata_already_exists {
        assert_eq!(user_token_balance.amount, amount);
    }
    println!(
        "🌟 User {} balance after mint: {}",
        token_name, user_token_balance.amount
    );

    println!("🌟 {} mint tx: {}", token_name, token_mint_tx);
    println!("\n\n");
    user_token_ata
}

pub async fn airdrop_sol_to_users(rpc: &RpcClient, users: &HashMap<Pubkey, String>) {
    for (user, name) in users {
        println!("🌟 airdropping sol to user {}", name);
        let airdrop_result = rpc.request_airdrop(user, 100 * LAMPORTS_PER_SOL).await;
        match airdrop_result {
            Ok(signature) => println!("✅ User {} airdrop successful: {}", user, signature),
            Err(e) => println!("❌ User {} airdrop failed: {:?}", user, e),
        }
        // Wait for airdrops to be confirmed
        println!("Waiting for airdrops to be confirmed...");
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // // Check actual balances
        let user_balance = rpc.get_balance(user).await.unwrap();
        println!("🌟 User {} balance: {}", name, user_balance);

        println!(
            "💰 Payer balance: {} lamports ({} SOL)",
            user_balance,
            user_balance as f64 / LAMPORTS_PER_SOL as f64
        );
    }
}
pub async fn setup_token_mint_ata_and_mint_to_many_users(
    rpc: &RpcClient,
    payer: &Keypair,
    mint_authority: &Keypair,
    users: &Vec<Pubkey>,
    program: &Program<&Keypair>,
    token_mint: &Keypair,
    amount: u64,
    bling_mint: &Keypair,
    usdc_mint: &Keypair,
    stablecoin_mint: &Keypair,
) -> HashMap<Pubkey, Pubkey> {
    // create a dictionary
    let mut users_token_atas = HashMap::new();
    for i in 0..users.len() {
        let user_i_token_ata = setup_token_mint_ata_and_mint_to(
            rpc,
            payer,
            mint_authority,
            &users[i],
            program,
            token_mint,
            amount,
            bling_mint,
            usdc_mint,
            stablecoin_mint,
        )
        .await;
        users_token_atas.insert(users[i], user_i_token_ata);
    }
    users_token_atas
}

pub async fn send_tx<T: Signers + ?Sized>(
    rpc: &RpcClient,
    ixs: Vec<Instruction>,
    payer: &Pubkey,
    signer: &T,
) -> anyhow::Result<Signature> {
    let blockhash = rpc.get_latest_blockhash().await?;
    let message = Message::try_compile(payer, &ixs, &[], blockhash)?;
    let v0_message = VersionedMessage::V0(message);
    let tx = VersionedTransaction::try_new(v0_message, signer)?;

    let result = rpc.send_and_confirm_transaction(&tx).await;

    // inspect error if any
    match result {
        Err(e) => {
            // eprintln!("❌ Transaction failed: {:#?}", e);
            eprintln!("❌ Transaction failed: {}", e);
            return Err(e.into());
        }
        Ok(signature) => {
            // Verify the transaction actually succeeded
            let status = rpc.get_signature_status(&signature).await?;

            if let Some(transaction_status) = status {
                if let Some(err) = transaction_status.err() {
                    return Err(anyhow::anyhow!("Transaction failed: {:?}", err));
                }
            }

            Ok(signature)
        }
    }
}

pub const PRIVILEGES_HASH: [u8; 32] = [0u8; 32];
