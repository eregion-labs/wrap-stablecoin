use anchor_client::{
    solana_sdk::{
        commitment_config::CommitmentConfig,
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair, Signer},
        system_instruction, system_program, sysvar,
        transaction::Transaction,
    },
    Cluster,
};
use anchor_lang::prelude::AnchorSerialize;
use anyhow::Result;
use sha2::{Digest, Sha256};
use anchor_client::solana_client::rpc_client::RpcClient;

const KLEND_PROGRAM_ID: &str = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
const WRAPPED_TOKEN_PROGRAM_ID: &str = "5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT";

const LENDING_MARKET_SIZE: usize = 4656;
const RESERVE_SIZE: usize = 8616;
const ACCOUNT_DISCRIMINATOR_LEN: usize = 8;
const LENDING_MARKET_SPACE: usize = LENDING_MARKET_SIZE + ACCOUNT_DISCRIMINATOR_LEN;
const RESERVE_SPACE: usize = RESERVE_SIZE + ACCOUNT_DISCRIMINATOR_LEN;

const LENDING_MARKET_AUTH_SEED: &[u8] = b"lma";

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}

fn get_rpc_client() -> Result<(RpcClient, Keypair)> {
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
    let rpc = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());

    Ok((rpc, payer))
}

// ============================================================================
// SPL Token Helpers
// ============================================================================

const MINT_SIZE: u64 = 82;
const TOKEN_ACCOUNT_SIZE: u64 = 165;

fn create_mint_ix(
    payer: &Pubkey,
    mint: &Pubkey,
    mint_authority: &Pubkey,
    decimals: u8,
    rent_lamports: u64,
) -> Vec<Instruction> {
    vec![
        system_instruction::create_account(
            payer,
            mint,
            rent_lamports,
            MINT_SIZE,
            &spl_token::id(),
        ),
        spl_token::instruction::initialize_mint2(
            &spl_token::id(),
            mint,
            mint_authority,
            None,
            decimals,
        )
        .unwrap(),
    ]
}

fn create_token_account_ix(
    payer: &Pubkey,
    account: &Pubkey,
    mint: &Pubkey,
    owner: &Pubkey,
    rent_lamports: u64,
) -> Vec<Instruction> {
    vec![
        system_instruction::create_account(
            payer,
            account,
            rent_lamports,
            TOKEN_ACCOUNT_SIZE,
            &spl_token::id(),
        ),
        spl_token::instruction::initialize_account3(
            &spl_token::id(),
            account,
            mint,
            owner,
        )
        .unwrap(),
    ]
}

fn mint_to_ix(
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
) -> Instruction {
    spl_token::instruction::mint_to(
        &spl_token::id(),
        mint,
        destination,
        authority,
        &[],
        amount,
    )
    .unwrap()
}

fn get_associated_token_address(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
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

// ============================================================================
// KLend Instruction Builders
// ============================================================================

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

#[derive(AnchorSerialize)]
struct InitReserveArgs {
    // Reserve configuration - simplified for testing
}

fn init_reserve_ix(
    program_id: Pubkey,
    lending_market_owner: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
    reserve: &Pubkey,
    reserve_liquidity_mint: &Pubkey,
    reserve_liquidity_supply: &Pubkey,
    fee_receiver: &Pubkey,
    reserve_collateral_mint: &Pubkey,
    // Oracles can be set to default pubkey for testing
    pyth_product: &Pubkey,
    pyth_price: &Pubkey,
    switchboard_feed: &Pubkey,
    switchboard_twap: &Pubkey,
    scope_prices: &Pubkey,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "init_reserve").to_vec();
    data.extend(InitReserveArgs {}.try_to_vec()?);

    let accounts = vec![
        AccountMeta::new(*lending_market_owner, true),
        AccountMeta::new(*lending_market, false),
        AccountMeta::new_readonly(*lending_market_authority, false),
        AccountMeta::new(*reserve, false),
        AccountMeta::new_readonly(*reserve_liquidity_mint, false),
        AccountMeta::new(*reserve_liquidity_supply, false),
        AccountMeta::new(*fee_receiver, false),
        AccountMeta::new(*reserve_collateral_mint, false),
        AccountMeta::new_readonly(*pyth_product, false),
        AccountMeta::new_readonly(*pyth_price, false),
        AccountMeta::new_readonly(*switchboard_feed, false),
        AccountMeta::new_readonly(*switchboard_twap, false),
        AccountMeta::new_readonly(*scope_prices, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(system_program::id(), false),
        AccountMeta::new_readonly(sysvar::rent::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

#[derive(AnchorSerialize)]
struct DepositReserveLiquidityArgs {
    liquidity_amount: u64,
}

fn deposit_reserve_liquidity_ix(
    program_id: Pubkey,
    owner: &Pubkey,
    reserve: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
    reserve_liquidity_supply: &Pubkey,
    reserve_collateral_mint: &Pubkey,
    user_source_liquidity: &Pubkey,
    user_destination_collateral: &Pubkey,
    liquidity_amount: u64,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "deposit_reserve_liquidity").to_vec();
    data.extend(DepositReserveLiquidityArgs { liquidity_amount }.try_to_vec()?);

    let accounts = vec![
        AccountMeta::new(*owner, true),
        AccountMeta::new(*reserve, false),
        AccountMeta::new_readonly(*lending_market, false),
        AccountMeta::new_readonly(*lending_market_authority, false),
        AccountMeta::new(*reserve_liquidity_supply, false),
        AccountMeta::new(*reserve_collateral_mint, false),
        AccountMeta::new(*user_source_liquidity, false),
        AccountMeta::new(*user_destination_collateral, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(sysvar::instructions::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

// ============================================================================
// Wrapped Token Program Instruction Builders
// ============================================================================

#[derive(AnchorSerialize)]
struct WrapArgs {
    amount: u64,
}

fn wrapped_token_initialize_ix(
    program_id: Pubkey,
    authority: &Pubkey,
    usdc_mint: &Pubkey,
    vault_config: &Pubkey,
    wrapped_mint: &Pubkey,
    vault_authority: &Pubkey,
    lending_market: &Pubkey,
    reserve: &Pubkey,
    collateral_mint: &Pubkey,
    collateral_vault: &Pubkey,
    treasury: &Pubkey,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "initialize").to_vec();

    let accounts = vec![
        AccountMeta::new(*authority, true),
        AccountMeta::new_readonly(*usdc_mint, false),
        AccountMeta::new(*vault_config, false),
        AccountMeta::new(*wrapped_mint, false),
        AccountMeta::new_readonly(*vault_authority, false),
        AccountMeta::new_readonly(*lending_market, false),
        AccountMeta::new_readonly(*reserve, false),
        AccountMeta::new_readonly(*collateral_mint, false),
        AccountMeta::new(*collateral_vault, false),
        AccountMeta::new_readonly(*treasury, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

fn wrapped_token_wrap_ix(
    program_id: Pubkey,
    user: &Pubkey,
    vault_config: &Pubkey,
    vault_authority: &Pubkey,
    user_usdc: &Pubkey,
    user_wrapped: &Pubkey,
    wrapped_mint: &Pubkey,
    klend_program: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
    reserve: &Pubkey,
    reserve_liquidity_supply: &Pubkey,
    reserve_collateral_mint: &Pubkey,
    collateral_vault: &Pubkey,
    amount: u64,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "wrap").to_vec();
    data.extend(WrapArgs { amount }.try_to_vec()?);

    let accounts = vec![
        AccountMeta::new(*user, true),
        AccountMeta::new(*vault_config, false),
        AccountMeta::new_readonly(*vault_authority, false),
        AccountMeta::new(*user_usdc, false),
        AccountMeta::new(*user_wrapped, false),
        AccountMeta::new(*wrapped_mint, false),
        AccountMeta::new_readonly(*klend_program, false),
        AccountMeta::new_readonly(*lending_market, false),
        AccountMeta::new_readonly(*lending_market_authority, false),
        AccountMeta::new(*reserve, false),
        AccountMeta::new(*reserve_liquidity_supply, false),
        AccountMeta::new(*reserve_collateral_mint, false),
        AccountMeta::new(*collateral_vault, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(sysvar::instructions::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

#[derive(AnchorSerialize)]
struct UnwrapArgs {
    amount: u64,
    collateral_amount: u64,
}

fn wrapped_token_unwrap_ix(
    program_id: Pubkey,
    user: &Pubkey,
    vault_config: &Pubkey,
    vault_authority: &Pubkey,
    user_wrapped: &Pubkey,
    user_usdc: &Pubkey,
    wrapped_mint: &Pubkey,
    klend_program: &Pubkey,
    lending_market: &Pubkey,
    lending_market_authority: &Pubkey,
    reserve: &Pubkey,
    reserve_liquidity_supply: &Pubkey,
    reserve_collateral_mint: &Pubkey,
    collateral_vault: &Pubkey,
    amount: u64,
    collateral_amount: u64,
) -> Result<Instruction> {
    let mut data = anchor_sighash("global", "unwrap").to_vec();
    data.extend(UnwrapArgs { amount, collateral_amount }.try_to_vec()?);

    let accounts = vec![
        AccountMeta::new(*user, true),
        AccountMeta::new(*vault_config, false),
        AccountMeta::new_readonly(*vault_authority, false),
        AccountMeta::new(*user_wrapped, false),
        AccountMeta::new(*user_usdc, false),
        AccountMeta::new(*wrapped_mint, false),
        AccountMeta::new_readonly(*klend_program, false),
        AccountMeta::new_readonly(*lending_market, false),
        AccountMeta::new_readonly(*lending_market_authority, false),
        AccountMeta::new(*reserve, false),
        AccountMeta::new(*reserve_liquidity_supply, false),
        AccountMeta::new(*reserve_collateral_mint, false),
        AccountMeta::new(*collateral_vault, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(sysvar::instructions::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

// ============================================================================
// Test: Setup KLend Infrastructure
// ============================================================================

#[test]
fn test_01_setup_klend_lending_market() -> Result<()> {
    let (rpc, payer) = get_rpc_client()?;
    let klend_program_id: Pubkey = KLEND_PROGRAM_ID.parse()?;

    eprintln!("Using RPC: {}", rpc.url());
    eprintln!("Payer: {}", payer.pubkey());

    // Verify KLend program is loaded
    let program_account = rpc.get_account(&klend_program_id)?;
    assert!(program_account.executable, "KLend program not executable");
    eprintln!("KLend program verified");

    // Create lending market
    let lending_market = Keypair::new();
    let (lending_market_authority, _) = Pubkey::find_program_address(
        &[LENDING_MARKET_AUTH_SEED, lending_market.pubkey().as_ref()],
        &klend_program_id,
    );

    let mut quote_currency = [0u8; 32];
    quote_currency[..3].copy_from_slice(b"USD");

    let rent_lamports = rpc.get_minimum_balance_for_rent_exemption(LENDING_MARKET_SPACE)?;
    let create_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &lending_market.pubkey(),
        rent_lamports,
        LENDING_MARKET_SPACE as u64,
        &klend_program_id,
    );

    let init_ix = init_lending_market_ix(
        klend_program_id,
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

    eprintln!("===========================================");
    eprintln!("Lending Market initialized!");
    eprintln!("Lending Market: {}", lending_market.pubkey());
    eprintln!("Lending Market Authority: {}", lending_market_authority);
    eprintln!("Tx: {}", signature);
    eprintln!("===========================================");
    eprintln!();
    eprintln!("Save these values for subsequent tests:");
    eprintln!("export LENDING_MARKET={}", lending_market.pubkey());

    Ok(())
}

#[test]
fn test_02_create_usdc_mint() -> Result<()> {
    let (rpc, payer) = get_rpc_client()?;

    eprintln!("Creating USDC mint...");

    let usdc_mint = Keypair::new();
    let rent_lamports = rpc.get_minimum_balance_for_rent_exemption(MINT_SIZE as usize)?;

    let ixs = create_mint_ix(
        &payer.pubkey(),
        &usdc_mint.pubkey(),
        &payer.pubkey(),
        6, // USDC decimals
        rent_lamports,
    );

    let recent_blockhash = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &ixs,
        Some(&payer.pubkey()),
        &[&payer, &usdc_mint],
        recent_blockhash,
    );

    let signature = rpc.send_and_confirm_transaction(&tx)?;

    eprintln!("===========================================");
    eprintln!("USDC Mint created!");
    eprintln!("USDC Mint: {}", usdc_mint.pubkey());
    eprintln!("Tx: {}", signature);
    eprintln!("===========================================");
    eprintln!();
    eprintln!("export USDC_MINT={}", usdc_mint.pubkey());

    Ok(())
}

#[test]
#[ignore = "Requires LENDING_MARKET and USDC_MINT env vars - run after test_01 and test_02"]
fn test_03_initialize_wrapped_vault() -> Result<()> {
    let (rpc, payer) = get_rpc_client()?;
    let program_id: Pubkey = WRAPPED_TOKEN_PROGRAM_ID.parse()?;
    let klend_program_id: Pubkey = KLEND_PROGRAM_ID.parse()?;

    // Get required addresses from env
    let lending_market: Pubkey = std::env::var("LENDING_MARKET")
        .expect("LENDING_MARKET env var required")
        .parse()?;
    let usdc_mint: Pubkey = std::env::var("USDC_MINT")
        .expect("USDC_MINT env var required")
        .parse()?;
    let reserve: Pubkey = std::env::var("RESERVE")
        .expect("RESERVE env var required")
        .parse()?;
    let collateral_mint: Pubkey = std::env::var("COLLATERAL_MINT")
        .expect("COLLATERAL_MINT env var required")
        .parse()?;

    eprintln!("Initializing wrapped vault...");
    eprintln!("USDC Mint: {}", usdc_mint);
    eprintln!("Lending Market: {}", lending_market);
    eprintln!("Reserve: {}", reserve);
    eprintln!("Collateral Mint: {}", collateral_mint);

    // Derive PDAs
    let (vault_config, _) = Pubkey::find_program_address(
        &[b"vault_config", usdc_mint.as_ref()],
        &program_id,
    );
    let (wrapped_mint, _) = Pubkey::find_program_address(
        &[b"wrapped_mint", vault_config.as_ref()],
        &program_id,
    );
    let (vault_authority, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_config.as_ref()],
        &program_id,
    );
    let (collateral_vault, _) = Pubkey::find_program_address(
        &[b"collateral_vault", vault_config.as_ref()],
        &program_id,
    );

    // Create treasury ATA
    let treasury = get_associated_token_address(&payer.pubkey(), &usdc_mint);

    // Check if treasury ATA exists, create if not
    if rpc.get_account(&treasury).is_err() {
        let create_treasury_ix = create_ata_ix(&payer.pubkey(), &payer.pubkey(), &usdc_mint);
        let recent_blockhash = rpc.get_latest_blockhash()?;
        let tx = Transaction::new_signed_with_payer(
            &[create_treasury_ix],
            Some(&payer.pubkey()),
            &[&payer],
            recent_blockhash,
        );
        rpc.send_and_confirm_transaction(&tx)?;
        eprintln!("Created treasury ATA: {}", treasury);
    }

    let ix = wrapped_token_initialize_ix(
        program_id,
        &payer.pubkey(),
        &usdc_mint,
        &vault_config,
        &wrapped_mint,
        &vault_authority,
        &lending_market,
        &reserve,
        &collateral_mint,
        &collateral_vault,
        &treasury,
    )?;

    let recent_blockhash = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let signature = rpc.send_and_confirm_transaction(&tx)?;

    eprintln!("===========================================");
    eprintln!("Wrapped Vault initialized!");
    eprintln!("Vault Config: {}", vault_config);
    eprintln!("Wrapped Mint (wStable): {}", wrapped_mint);
    eprintln!("Vault Authority: {}", vault_authority);
    eprintln!("Collateral Vault: {}", collateral_vault);
    eprintln!("Tx: {}", signature);
    eprintln!("===========================================");

    Ok(())
}

#[test]
#[ignore = "Requires full setup - run after test_03"]
fn test_04_wrap_usdc() -> Result<()> {
    let (rpc, payer) = get_rpc_client()?;
    let program_id: Pubkey = WRAPPED_TOKEN_PROGRAM_ID.parse()?;
    let klend_program_id: Pubkey = KLEND_PROGRAM_ID.parse()?;

    let usdc_mint: Pubkey = std::env::var("USDC_MINT")?.parse()?;
    let lending_market: Pubkey = std::env::var("LENDING_MARKET")?.parse()?;
    let reserve: Pubkey = std::env::var("RESERVE")?.parse()?;
    let collateral_mint: Pubkey = std::env::var("COLLATERAL_MINT")?.parse()?;
    let reserve_liquidity_supply: Pubkey = std::env::var("RESERVE_LIQUIDITY_SUPPLY")?.parse()?;

    let (vault_config, _) = Pubkey::find_program_address(
        &[b"vault_config", usdc_mint.as_ref()],
        &program_id,
    );
    let (wrapped_mint, _) = Pubkey::find_program_address(
        &[b"wrapped_mint", vault_config.as_ref()],
        &program_id,
    );
    let (vault_authority, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_config.as_ref()],
        &program_id,
    );
    let (collateral_vault, _) = Pubkey::find_program_address(
        &[b"collateral_vault", vault_config.as_ref()],
        &program_id,
    );
    let (lending_market_authority, _) = Pubkey::find_program_address(
        &[LENDING_MARKET_AUTH_SEED, lending_market.as_ref()],
        &klend_program_id,
    );

    let user_usdc = get_associated_token_address(&payer.pubkey(), &usdc_mint);
    let user_wrapped = get_associated_token_address(&payer.pubkey(), &wrapped_mint);

    // Create user wrapped ATA if doesn't exist
    if rpc.get_account(&user_wrapped).is_err() {
        let create_ata_ix = create_ata_ix(&payer.pubkey(), &payer.pubkey(), &wrapped_mint);
        let recent_blockhash = rpc.get_latest_blockhash()?;
        let tx = Transaction::new_signed_with_payer(
            &[create_ata_ix],
            Some(&payer.pubkey()),
            &[&payer],
            recent_blockhash,
        );
        rpc.send_and_confirm_transaction(&tx)?;
    }

    let wrap_amount = 1_000_000u64; // 1 USDC

    let ix = wrapped_token_wrap_ix(
        program_id,
        &payer.pubkey(),
        &vault_config,
        &vault_authority,
        &user_usdc,
        &user_wrapped,
        &wrapped_mint,
        &klend_program_id,
        &lending_market,
        &lending_market_authority,
        &reserve,
        &reserve_liquidity_supply,
        &collateral_mint,
        &collateral_vault,
        wrap_amount,
    )?;

    let recent_blockhash = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let signature = rpc.send_and_confirm_transaction(&tx)?;

    eprintln!("===========================================");
    eprintln!("Wrapped {} USDC!", wrap_amount);
    eprintln!("Tx: {}", signature);
    eprintln!("===========================================");

    Ok(())
}

#[test]
#[ignore = "Requires wrapped tokens - run after test_04"]
fn test_05_unwrap_wstable() -> Result<()> {
    let (rpc, payer) = get_rpc_client()?;
    let program_id: Pubkey = WRAPPED_TOKEN_PROGRAM_ID.parse()?;
    let klend_program_id: Pubkey = KLEND_PROGRAM_ID.parse()?;

    let usdc_mint: Pubkey = std::env::var("USDC_MINT")?.parse()?;
    let lending_market: Pubkey = std::env::var("LENDING_MARKET")?.parse()?;
    let reserve: Pubkey = std::env::var("RESERVE")?.parse()?;
    let collateral_mint: Pubkey = std::env::var("COLLATERAL_MINT")?.parse()?;
    let reserve_liquidity_supply: Pubkey = std::env::var("RESERVE_LIQUIDITY_SUPPLY")?.parse()?;

    let (vault_config, _) = Pubkey::find_program_address(
        &[b"vault_config", usdc_mint.as_ref()],
        &program_id,
    );
    let (wrapped_mint, _) = Pubkey::find_program_address(
        &[b"wrapped_mint", vault_config.as_ref()],
        &program_id,
    );
    let (vault_authority, _) = Pubkey::find_program_address(
        &[b"vault_authority", vault_config.as_ref()],
        &program_id,
    );
    let (collateral_vault, _) = Pubkey::find_program_address(
        &[b"collateral_vault", vault_config.as_ref()],
        &program_id,
    );
    let (lending_market_authority, _) = Pubkey::find_program_address(
        &[LENDING_MARKET_AUTH_SEED, lending_market.as_ref()],
        &klend_program_id,
    );

    let user_usdc = get_associated_token_address(&payer.pubkey(), &usdc_mint);
    let user_wrapped = get_associated_token_address(&payer.pubkey(), &wrapped_mint);

    let unwrap_amount = 1_000_000u64; // 1 wStable
    let collateral_amount = 1_000_000u64; // Approximate - should be calculated from exchange rate

    let ix = wrapped_token_unwrap_ix(
        program_id,
        &payer.pubkey(),
        &vault_config,
        &vault_authority,
        &user_wrapped,
        &user_usdc,
        &wrapped_mint,
        &klend_program_id,
        &lending_market,
        &lending_market_authority,
        &reserve,
        &reserve_liquidity_supply,
        &collateral_mint,
        &collateral_vault,
        unwrap_amount,
        collateral_amount,
    )?;

    let recent_blockhash = rpc.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let signature = rpc.send_and_confirm_transaction(&tx)?;

    eprintln!("===========================================");
    eprintln!("Unwrapped {} wStable!", unwrap_amount);
    eprintln!("Tx: {}", signature);
    eprintln!("===========================================");

    Ok(())
}
