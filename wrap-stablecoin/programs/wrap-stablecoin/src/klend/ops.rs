use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::klend::{deposit_reserve_liquidity_ix, redeem_reserve_collateral_ix};
use crate::utils::get_token_balance;

/// CPI: underlying `token_vault` → Kamino `collateral_vault` (kTokens).
pub fn deposit_liquidity<'info>(
    klend_program: &AccountInfo<'info>,
    vault_authority: &AccountInfo<'info>,
    reserve: &AccountInfo<'info>,
    lending_market: &AccountInfo<'info>,
    lending_market_authority: &AccountInfo<'info>,
    token_mint: &AccountInfo<'info>,
    reserve_liquidity_supply: &AccountInfo<'info>,
    reserve_collateral_mint: &AccountInfo<'info>,
    token_vault: &AccountInfo<'info>,
    collateral_vault: &AccountInfo<'info>,
    collateral_token_program: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    instruction_sysvar: &AccountInfo<'info>,
    authority_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    let ix = deposit_reserve_liquidity_ix(
        klend_program.key(),
        vault_authority.key(),
        reserve.key(),
        lending_market.key(),
        lending_market_authority.key(),
        token_mint.key(),
        reserve_liquidity_supply.key(),
        reserve_collateral_mint.key(),
        token_vault.key(),
        collateral_vault.key(),
        collateral_token_program.key(),
        token_program.key(),
        instruction_sysvar.key(),
        amount,
    );

    invoke_signed(
        &ix,
        &[
            vault_authority.clone(),
            reserve.clone(),
            lending_market.clone(),
            lending_market_authority.clone(),
            token_mint.clone(),
            reserve_liquidity_supply.clone(),
            reserve_collateral_mint.clone(),
            token_vault.clone(),
            collateral_vault.clone(),
            collateral_token_program.clone(),
            token_program.clone(),
            instruction_sysvar.clone(),
        ],
        authority_seeds,
    )?;
    Ok(())
}

/// CPI: kTokens `collateral_vault` → underlying `token_vault`. Returns liquidity received.
pub fn redeem_collateral<'info>(
    klend_program: &AccountInfo<'info>,
    vault_authority: &AccountInfo<'info>,
    lending_market: &AccountInfo<'info>,
    reserve: &AccountInfo<'info>,
    lending_market_authority: &AccountInfo<'info>,
    token_mint: &AccountInfo<'info>,
    reserve_collateral_mint: &AccountInfo<'info>,
    reserve_liquidity_supply: &AccountInfo<'info>,
    collateral_vault: &AccountInfo<'info>,
    token_vault: &AccountInfo<'info>,
    collateral_token_program: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    instruction_sysvar: &AccountInfo<'info>,
    authority_seeds: &[&[&[u8]]],
    collateral_amount: u64,
) -> Result<u64> {
    let liquidity_before = get_token_balance(token_vault)?;

    let ix = redeem_reserve_collateral_ix(
        klend_program.key(),
        vault_authority.key(),
        lending_market.key(),
        reserve.key(),
        lending_market_authority.key(),
        token_mint.key(),
        reserve_collateral_mint.key(),
        reserve_liquidity_supply.key(),
        collateral_vault.key(),
        token_vault.key(),
        collateral_token_program.key(),
        token_program.key(),
        instruction_sysvar.key(),
        collateral_amount,
    );

    invoke_signed(
        &ix,
        &[
            vault_authority.clone(),
            lending_market.clone(),
            reserve.clone(),
            lending_market_authority.clone(),
            token_mint.clone(),
            reserve_collateral_mint.clone(),
            reserve_liquidity_supply.clone(),
            collateral_vault.clone(),
            token_vault.clone(),
            collateral_token_program.clone(),
            token_program.clone(),
            instruction_sysvar.clone(),
        ],
        authority_seeds,
    )?;

    let liquidity_after = get_token_balance(token_vault)?;
    liquidity_after
        .checked_sub(liquidity_before)
        .ok_or(error!(crate::errors::ErrorCode::MathOverflow))
}
