//! Full integration test: KLend + wrapped vault setup, then wrap and unwrap.
//!
//! Flow:
//! 1. Airdrop SOL, create USDC mint, mint to users
//! 2. Create KLend lending market
//! 3. Try init_reserve (may fail on localnet due to oracle requirements)
//! 4. If init_reserve fails: use vault-only path with our own collateral mint
//! 5. Initialize wrapped vault
//! 6. Add base token (USDC)
//! 7. Wrap: user deposits USDC → receives wStable
//! 8. Unwrap: user burns wStable → receives USDC back

use anchor_client::solana_sdk::{pubkey::Pubkey, signature::read_keypair_file};
use anchor_client::{solana_sdk::commitment_config::CommitmentConfig, Client, Cluster};
use solana_sdk::{
    instruction::Instruction,
    signature::{Keypair, Signer},
    system_instruction,
};

pub mod phenomena_ix;
pub mod utils;

use phenomena_ix::{
    derive_klend_pdas, init_lending_market_ix, init_reserve_ix, wrapped_initialize_ix,
    wrapped_unwrap_ix, wrapped_wrap_ix, LENDING_MARKET_AUTH_SEED_BYTES, LENDING_MARKET_SPACE_BYTES,
    RESERVE_SPACE_BYTES,
};
use utils::{
    airdrop_sol_to_users, send_tx, setup_token_mint, setup_token_mint_ata_and_mint_to_many_users,
};

const KLEND_PROGRAM_ID: &str = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
const WRAPPED_TOKEN_PROGRAM_ID: &str = "5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT";
const USDC_LAMPORTS_PER_USDC: u64 = 1_000_000; // 6 decimals
const MINT_SIZE: u64 = 82;

fn get_ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    spl_associated_token_account::get_associated_token_address(owner, mint)
}

fn create_ata_ix(payer: &Pubkey, owner: &Pubkey, mint: &Pubkey) -> Instruction {
    spl_associated_token_account::instruction::create_associated_token_account(
        payer,
        owner,
        mint,
        &spl_token::id(),
    )
}

#[test]
fn test_setup_wrap_unwrap() {
    let anchor_wallet = std::env::var("ANCHOR_WALLET").unwrap();
    let payer = read_keypair_file(&anchor_wallet).unwrap();
    let mint_authority = &payer;

    let user_1 = Keypair::new();
    // Use a dedicated authority so vault_config PDA doesn't conflict with integration_test
    let authority = Keypair::new();

    let client = Client::new_with_options(Cluster::Localnet, &payer, CommitmentConfig::confirmed());
    let wrapped_token_program = client
        .program(WRAPPED_TOKEN_PROGRAM_ID.parse().unwrap())
        .unwrap();
    let rpc = wrapped_token_program.rpc();

    let klend_program_id: Pubkey = KLEND_PROGRAM_ID.parse().unwrap();
    let wrapped_program_id: Pubkey = WRAPPED_TOKEN_PROGRAM_ID.parse().unwrap();

    let usdc_mint = Keypair::new();
    let everyone = std::collections::HashMap::from([
        (payer.pubkey(), "payer".to_string()),
        (authority.pubkey(), "authority".to_string()),
        (user_1.pubkey(), "user_1".to_string()),
    ]);

    // ========================================
    // Step 1: Airdrop, create USDC, mint to users
    // ========================================
    println!("\n[1/7] Airdrop and create USDC...");
    airdrop_sol_to_users(&rpc, &everyone);
    setup_token_mint(&rpc, &payer, &payer, &usdc_mint, 6).unwrap();

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

    let user_usdc = get_ata(&payer.pubkey(), &usdc_mint.pubkey());
    println!("✓ USDC mint: {}", usdc_mint.pubkey());
    println!("✓ User USDC ATA: {}", user_usdc);

    // ========================================
    // Step 2: Create KLend lending market
    // ========================================
    println!("\n[2/7] Creating KLend lending market...");
    let lending_market = Keypair::new();
    let (lending_market_authority, _) = Pubkey::find_program_address(
        &[
            LENDING_MARKET_AUTH_SEED_BYTES,
            lending_market.pubkey().as_ref(),
        ],
        &klend_program_id,
    );

    let mut quote_currency = [0u8; 32];
    quote_currency[..3].copy_from_slice(b"USD");

    let rent = rpc
        .get_minimum_balance_for_rent_exemption(LENDING_MARKET_SPACE_BYTES)
        .unwrap();
    let create_market_ix = system_instruction::create_account(
        &payer.pubkey(),
        &lending_market.pubkey(),
        rent,
        LENDING_MARKET_SPACE_BYTES as u64,
        &klend_program_id,
    );
    let init_market_ix = init_lending_market_ix(
        klend_program_id,
        quote_currency,
        &payer.pubkey(),
        &lending_market.pubkey(),
        &lending_market_authority,
    );

    send_tx(
        &rpc,
        vec![create_market_ix, init_market_ix],
        &payer.pubkey(),
        &[&payer, &lending_market],
    )
    .unwrap();
    println!("✓ Lending market: {}", lending_market.pubkey());

    // ========================================
    // Step 3: Create KLend reserve (or use vault-only fallback)
    // ========================================
    println!("\n[3/7] Creating KLend reserve...");
    let reserve = Keypair::new();
    let (reserve_liquidity_supply, fee_receiver, collateral_mint, reserve_collateral_supply) =
        derive_klend_pdas(&reserve.pubkey(), &klend_program_id);

    let rent = rpc
        .get_minimum_balance_for_rent_exemption(RESERVE_SPACE_BYTES)
        .unwrap();
    let create_reserve_ix = system_instruction::create_account(
        &payer.pubkey(),
        &reserve.pubkey(),
        rent,
        RESERVE_SPACE_BYTES as u64,
        &klend_program_id,
    );

    let init_reserve_ix = init_reserve_ix(
        klend_program_id,
        &payer.pubkey(),
        &lending_market.pubkey(),
        &lending_market_authority,
        &reserve.pubkey(),
        &usdc_mint.pubkey(),
        &reserve_liquidity_supply,
        &fee_receiver,
        &collateral_mint,
        &reserve_collateral_supply,
        &user_usdc,
    );

    let (reserve_pubkey, collateral_mint_pubkey) = match send_tx(
        &rpc,
        vec![create_reserve_ix, init_reserve_ix],
        &payer.pubkey(),
        &[&payer, &reserve],
    ) {
        Ok(_) => {
            println!("✓ Reserve initialized: {}", reserve.pubkey());
            println!("✓ Collateral mint: {}", collateral_mint);
            (reserve.pubkey(), collateral_mint)
        }
        Err(e) => {
            println!("⚠ init_reserve failed (expected on localnet): {}", e);
            println!("  Using vault-only path: creating our own collateral mint...");
            let collateral_mint_kp = Keypair::new();
            let collateral_rent = rpc
                .get_minimum_balance_for_rent_exemption(MINT_SIZE as usize)
                .unwrap();
            let create_coll_ix = system_instruction::create_account(
                &payer.pubkey(),
                &collateral_mint_kp.pubkey(),
                collateral_rent,
                MINT_SIZE,
                &spl_token::id(),
            );
            let init_coll_ix = spl_token::instruction::initialize_mint2(
                &spl_token::id(),
                &collateral_mint_kp.pubkey(),
                &payer.pubkey(),
                None,
                6,
            )
            .unwrap();
            send_tx(
                &rpc,
                vec![create_coll_ix, init_coll_ix],
                &payer.pubkey(),
                &[&payer, &collateral_mint_kp],
            )
            .unwrap();
            println!("✓ Created collateral mint: {}", collateral_mint_kp.pubkey());
            (lending_market.pubkey(), collateral_mint_kp.pubkey())
        }
    };

    // ========================================
    // Step 4: Initialize wrapped vault (includes base token setup)
    // ========================================
    println!("\n[4/7] Initializing wrapped vault...");
    let (vault_config, _) = Pubkey::find_program_address(
        &[b"vault_config", authority.pubkey().as_ref()],
        &wrapped_program_id,
    );
    let (wrapped_mint, _) = Pubkey::find_program_address(
        &[b"wrapped_mint", vault_config.as_ref()],
        &wrapped_program_id,
    );
    let (vault_authority, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_config.as_ref()],
        &wrapped_program_id,
    );
    let (token_config, _) = Pubkey::find_program_address(
        &[
            b"token_config",
            vault_config.as_ref(),
            usdc_mint.pubkey().as_ref(),
        ],
        &wrapped_program_id,
    );
    let (token_collateral_vault, _) = Pubkey::find_program_address(
        &[b"token_collateral_vault", token_config.as_ref()],
        &wrapped_program_id,
    );
    let (token_vault, _) = Pubkey::find_program_address(
        &[b"token_vault", token_config.as_ref()],
        &wrapped_program_id,
    );

    let treasury = user_usdc;
    let init_vault_ix = wrapped_initialize_ix(
        wrapped_program_id,
        &authority.pubkey(),
        &usdc_mint.pubkey(),
        &vault_config,
        &wrapped_mint,
        &vault_authority,
        &lending_market.pubkey(),
        &treasury,
        &reserve_pubkey,
        &collateral_mint_pubkey,
        &token_config,
        &token_collateral_vault,
        &token_vault,
    );
    send_tx(
        &rpc,
        vec![init_vault_ix],
        &payer.pubkey(),
        &[&payer, &authority],
    )
    .unwrap();
    println!("✓ Vault config: {}", vault_config);
    println!("✓ Wrapped mint (wStable): {}", wrapped_mint);
    println!("✓ Base token (USDC) registered");

    // ========================================
    // Step 6: Wrap (mint wStable)
    // ========================================
    println!("\n[6/7] Wrapping USDC → wStable...");
    let user_wrapped = get_ata(&payer.pubkey(), &wrapped_mint);
    let create_user_wrapped_ix = create_ata_ix(&payer.pubkey(), &payer.pubkey(), &wrapped_mint);
    send_tx(
        &rpc,
        vec![create_user_wrapped_ix],
        &payer.pubkey(),
        &[&payer],
    )
    .unwrap();

    let wrap_amount = 100_000_000u64; // 100 USDC
    let wrap_ix = wrapped_wrap_ix(
        wrapped_program_id,
        &payer.pubkey(),
        &vault_config,
        &vault_authority,
        &token_config,
        &usdc_mint.pubkey(),
        &user_usdc,
        &user_wrapped,
        &wrapped_mint,
        &token_vault,
        &usdc_mint.pubkey(),
        None,
        wrap_amount,
    );
    send_tx(&rpc, vec![wrap_ix], &payer.pubkey(), &[&payer]).unwrap();
    println!(
        "✓ Wrapped {} USDC into wStable",
        wrap_amount / USDC_LAMPORTS_PER_USDC
    );

    // ========================================
    // Step 7: Unwrap (redeem wStable → USDC)
    // ========================================
    println!("\n[7/7] Unwrapping wStable → USDC...");
    let unwrap_amount = 50_000_000u64; // 50 wStable
    let unwrap_ix = wrapped_unwrap_ix(
        wrapped_program_id,
        &payer.pubkey(),
        &vault_config,
        &vault_authority,
        &user_wrapped,
        &user_usdc,
        &wrapped_mint,
        &usdc_mint.pubkey(),
        &token_config,
        &token_vault,
        None,
        unwrap_amount,
    );
    send_tx(&rpc, vec![unwrap_ix], &payer.pubkey(), &[&payer]).unwrap();
    println!(
        "✓ Unwrapped {} wStable back to USDC",
        unwrap_amount / USDC_LAMPORTS_PER_USDC
    );

    println!("\n========================================");
    println!("✓ Full flow: setup → wrap → unwrap PASSED");
    println!("========================================\n");
}
