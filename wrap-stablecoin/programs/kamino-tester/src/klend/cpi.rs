use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use sha2::{Digest, Sha256};

pub const KLEND_PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
pub const LENDING_MARKET_AUTH_SEED: &[u8] = b"lma";

fn anchor_sighash(namespace: &str, name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("{namespace}:{name}"));
    let hash = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hash[..8]);
    sighash
}

#[derive(AnchorSerialize)]
pub struct DepositReserveLiquidityArgs {
    pub liquidity_amount: u64,
}

pub fn deposit_reserve_liquidity_ix(
    klend_program: Pubkey,
    owner: Pubkey,
    reserve: Pubkey,
    lending_market: Pubkey,
    lending_market_authority: Pubkey,
    reserve_liquidity_mint: Pubkey,
    reserve_liquidity_supply: Pubkey,
    reserve_collateral_mint: Pubkey,
    user_source_liquidity: Pubkey,
    user_destination_collateral: Pubkey,
    collateral_token_program: Pubkey,
    liquidity_token_program: Pubkey,
    instruction_sysvar: Pubkey,
    liquidity_amount: u64,
) -> Instruction {
    let mut data = anchor_sighash("global", "deposit_reserve_liquidity").to_vec();
    data.extend(
        DepositReserveLiquidityArgs { liquidity_amount }
            .try_to_vec()
            .unwrap(),
    );

    // Account order from KLend source:
    // 1. owner (signer)
    // 2. reserve
    // 3. lending_market
    // 4. lending_market_authority
    // 5. reserve_liquidity_mint
    // 6. reserve_liquidity_supply
    // 7. reserve_collateral_mint
    // 8. user_source_liquidity
    // 9. user_destination_collateral
    // 10. collateral_token_program
    // 11. liquidity_token_program
    // 12. instruction_sysvar
    Instruction {
        program_id: klend_program,
        accounts: vec![
            AccountMeta::new(owner, true),
            AccountMeta::new(reserve, false),
            AccountMeta::new_readonly(lending_market, false),
            AccountMeta::new_readonly(lending_market_authority, false),
            AccountMeta::new_readonly(reserve_liquidity_mint, false),
            AccountMeta::new(reserve_liquidity_supply, false),
            AccountMeta::new(reserve_collateral_mint, false),
            AccountMeta::new(user_source_liquidity, false),
            AccountMeta::new(user_destination_collateral, false),
            AccountMeta::new_readonly(collateral_token_program, false),
            AccountMeta::new_readonly(liquidity_token_program, false),
            AccountMeta::new_readonly(instruction_sysvar, false),
        ],
        data,
    }
}

#[derive(AnchorSerialize)]
pub struct RedeemReserveCollateralArgs {
    pub collateral_amount: u64,
}

pub fn redeem_reserve_collateral_ix(
    klend_program: Pubkey,
    owner: Pubkey,
    lending_market: Pubkey,
    reserve: Pubkey,
    lending_market_authority: Pubkey,
    reserve_liquidity_mint: Pubkey,
    reserve_collateral_mint: Pubkey,
    reserve_liquidity_supply: Pubkey,
    user_source_collateral: Pubkey,
    user_destination_liquidity: Pubkey,
    collateral_token_program: Pubkey,
    liquidity_token_program: Pubkey,
    instruction_sysvar: Pubkey,
    collateral_amount: u64,
) -> Instruction {
    let mut data = anchor_sighash("global", "redeem_reserve_collateral").to_vec();
    data.extend(
        RedeemReserveCollateralArgs { collateral_amount }
            .try_to_vec()
            .unwrap(),
    );

    // Account order from KLend source:
    // 1. owner
    // 2. lending_market
    // 3. reserve
    // 4. lending_market_authority
    // 5. reserve_liquidity_mint
    // 6. reserve_collateral_mint
    // 7. reserve_liquidity_supply
    // 8. user_source_collateral
    // 9. user_destination_liquidity
    // 10. collateral_token_program
    // 11. liquidity_token_program
    // 12. instruction_sysvar
    Instruction {
        program_id: klend_program,
        accounts: vec![
            AccountMeta::new(owner, true),
            AccountMeta::new_readonly(lending_market, false),
            AccountMeta::new(reserve, false),
            AccountMeta::new_readonly(lending_market_authority, false),
            AccountMeta::new_readonly(reserve_liquidity_mint, false),
            AccountMeta::new(reserve_collateral_mint, false),
            AccountMeta::new(reserve_liquidity_supply, false),
            AccountMeta::new(user_source_collateral, false),
            AccountMeta::new(user_destination_liquidity, false),
            AccountMeta::new_readonly(collateral_token_program, false),
            AccountMeta::new_readonly(liquidity_token_program, false),
            AccountMeta::new_readonly(instruction_sysvar, false),
        ],
        data,
    }
}

#[derive(AnchorSerialize)]
pub struct RefreshReserveArgs {}

pub fn refresh_reserve_ix(
    klend_program: Pubkey,
    reserve: Pubkey,
    lending_market: Pubkey,
    pyth_oracle: Option<Pubkey>,
    switchboard_price_oracle: Option<Pubkey>,
    switchboard_twap_oracle: Option<Pubkey>,
    scope_prices: Option<Pubkey>,
) -> Instruction {
    let mut data = anchor_sighash("global", "refresh_reserve").to_vec();
    data.extend(RefreshReserveArgs {}.try_to_vec().unwrap());

    let mut accounts = vec![
        AccountMeta::new(reserve, false),
        AccountMeta::new_readonly(lending_market, false),
    ];

    if let Some(pyth) = pyth_oracle {
        accounts.push(AccountMeta::new_readonly(pyth, false));
    }
    if let Some(sb_price) = switchboard_price_oracle {
        accounts.push(AccountMeta::new_readonly(sb_price, false));
    }
    if let Some(sb_twap) = switchboard_twap_oracle {
        accounts.push(AccountMeta::new_readonly(sb_twap, false));
    }
    if let Some(scope) = scope_prices {
        accounts.push(AccountMeta::new_readonly(scope, false));
    }

    Instruction {
        program_id: klend_program,
        accounts,
        data,
    }
}
