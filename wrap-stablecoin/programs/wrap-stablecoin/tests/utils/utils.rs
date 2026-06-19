use std::collections::HashMap;

use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::Instruction,
    message::{v0::Message, VersionedMessage},
    native_token::LAMPORTS_PER_SOL,
    program_pack::Pack,
    signature::{Keypair, Signature},
    signers::Signers,
    system_instruction,
    transaction::VersionedTransaction,
};
use solana_sdk::{pubkey::Pubkey, signer::Signer};
use spl_associated_token_account::instruction::create_associated_token_account;
use spl_token;

pub fn current_chain_timestamp(rpc: &RpcClient) -> i64 {
    let slot = rpc.get_slot().unwrap();
    rpc.get_block_time(slot).unwrap()
}

pub fn wait_for_seconds(seconds: u64) {
    println!("⏳ Waiting {} seconds…", seconds);
    std::thread::sleep(std::time::Duration::from_secs(seconds));
}

pub fn setup_token_mint(
    rpc: &RpcClient,
    payer: &Keypair,
    mint_authority: &Keypair,
    token_mint: &Keypair,
    decimals: u8,
) -> Result<Pubkey, anyhow::Error> {
    let space = spl_token::state::Mint::LEN;
    let rent = rpc.get_minimum_balance_for_rent_exemption(space)?;
    let create_token_mint_ix = system_instruction::create_account(
        &mint_authority.pubkey(),
        &token_mint.pubkey(),
        rent,
        spl_token::state::Mint::LEN as u64,
        &spl_token::ID,
    );
    let initialize_token_mint_ix = spl_token::instruction::initialize_mint2(
        &spl_token::ID,
        &token_mint.pubkey(),
        &mint_authority.pubkey(),
        None,
        decimals,
    )
    .unwrap();

    send_tx(
        rpc,
        vec![create_token_mint_ix, initialize_token_mint_ix],
        &payer.pubkey(),
        &[payer, token_mint],
    )?;
    Ok(mint_authority.pubkey())
}

pub fn setup_token_mint_ata_and_mint_to(
    rpc: &RpcClient,
    payer: &Keypair,
    mint_authority: &Keypair,
    mint_to: &Pubkey,
    token_mint: &Keypair,
    amount: u64,
    token_name: &str,
) -> Result<Pubkey, anyhow::Error> {
    let user_token_ata =
        spl_associated_token_account::get_associated_token_address(mint_to, &token_mint.pubkey());

    let ata_already_exists = rpc.get_account(&user_token_ata).is_ok();
    if !ata_already_exists {
        let create_ata_ix = create_associated_token_account(
            &payer.pubkey(),
            mint_to,
            &token_mint.pubkey(),
            &spl_token::ID,
        );
        send_tx(rpc, vec![create_ata_ix], &payer.pubkey(), &[payer])?;
    }

    let mint_token_to_user_ix = spl_token::instruction::mint_to(
        &spl_token::ID,
        &token_mint.pubkey(),
        &user_token_ata,
        &mint_authority.pubkey(),
        &[&mint_authority.pubkey()],
        amount,
    )
    .unwrap();

    send_tx(
        rpc,
        vec![mint_token_to_user_ix],
        &payer.pubkey(),
        &[mint_authority],
    )?;

    if !ata_already_exists {
        let account_data = rpc.get_account(&user_token_ata)?;
        let token_account = spl_token::state::Account::unpack(&account_data.data)?;
        assert_eq!(token_account.amount, amount);
    }

    Ok(user_token_ata)
}

pub fn airdrop_sol_to_users(rpc: &RpcClient, users: &HashMap<Pubkey, String>) {
    for (user, name) in users {
        println!("🌟 airdropping sol to user {}", name);
        match rpc.request_airdrop(user, 100 * LAMPORTS_PER_SOL) {
            Ok(signature) => println!("✅ User {} airdrop successful: {}", name, signature),
            Err(e) => println!("❌ User {} airdrop failed: {:?}", name, e),
        }
        println!("Waiting for airdrops to be confirmed...");
        std::thread::sleep(std::time::Duration::from_secs(2));

        let user_balance = rpc.get_balance(user).unwrap();
        println!(
            "🌟 User {} balance: {} lamports ({} SOL)",
            name,
            user_balance,
            user_balance as f64 / LAMPORTS_PER_SOL as f64
        );
    }
}

pub fn setup_token_mint_ata_and_mint_to_many_users(
    rpc: &RpcClient,
    payer: &Keypair,
    mint_authority: &Keypair,
    users: &[Pubkey],
    token_mint: &Keypair,
    amount: u64,
    token_name: &str,
) -> Result<HashMap<Pubkey, Pubkey>, anyhow::Error> {
    let mut users_token_atas = HashMap::new();
    for user in users {
        let user_ata = setup_token_mint_ata_and_mint_to(
            rpc,
            payer,
            mint_authority,
            user,
            token_mint,
            amount,
            token_name,
        )?;
        users_token_atas.insert(*user, user_ata);
    }
    Ok(users_token_atas)
}

pub fn send_tx<T: Signers + ?Sized>(
    rpc: &RpcClient,
    ixs: Vec<Instruction>,
    payer: &Pubkey,
    signer: &T,
) -> anyhow::Result<Signature> {
    let blockhash = rpc.get_latest_blockhash()?;
    let message = Message::try_compile(payer, &ixs, &[], blockhash)?;
    let v0_message = VersionedMessage::V0(message);
    let tx = VersionedTransaction::try_new(v0_message, signer)?;

    let signature = rpc.send_and_confirm_transaction(&tx)?;

    let status = rpc.get_signature_status(&signature)?;
    if let Some(transaction_status) = status {
        if let Some(err) = transaction_status.err() {
            return Err(anyhow::anyhow!("Transaction failed: {:?}", err));
        }
    }

    Ok(signature)
}

pub const PRIVILEGES_HASH: [u8; 32] = [0u8; 32];
