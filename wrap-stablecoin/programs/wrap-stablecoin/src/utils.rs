use anchor_lang::prelude::*;
use anchor_spl::token::ID as SPL_TOKEN_ID;
use anchor_spl::token_2022;

use crate::errors::ErrorCode;

/// Supported mint precision range. SPL stores decimals as `u8`; conversion uses `u128` intermediates.
pub const MIN_TOKEN_DECIMALS: u8 = 1;
pub const MAX_TOKEN_DECIMALS: u8 = 18;

const BPS_DENOM: u64 = 10_000;

/// Read the raw SPL Token / Token-2022 amount field (offset 64..72) from a token account.
///
/// Used for fresh balance reads post-CPI where the cached `InterfaceAccount::amount` is stale.
/// Verifies the account is owned by SPL Token or Token-2022 and has a full token-account layout
/// (165 bytes) to reject foot-gun misuse on arbitrary AccountInfos.
pub fn get_token_balance(token_account: &AccountInfo) -> Result<u64> {
    let owner = token_account.owner;
    require!(
        *owner == SPL_TOKEN_ID || *owner == token_2022::ID,
        ErrorCode::InvalidTokenAccountData
    );
    let data = token_account.try_borrow_data()?;
    require!(data.len() >= 165, ErrorCode::InvalidTokenAccountData);
    let amount = u64::from_le_bytes(
        data[64..72]
            .try_into()
            .map_err(|_| ErrorCode::InvalidTokenAccountData)?,
    );
    Ok(amount)
}

/// Classic SPL / Token-2022 mint size with no TLV extensions.
const PLAIN_MINT_SIZE: usize = 82;

/// Collateral may be classic SPL Token or Token-2022 with an empty extension set.
/// Unknown future Token-2022 extensions increase mint account size and fail closed.
pub fn assert_plain_collateral_mint(mint: &AccountInfo) -> Result<()> {
    let owner = mint.owner;
    if *owner == SPL_TOKEN_ID {
        return Ok(());
    }
    require!(
        *owner == token_2022::ID,
        ErrorCode::UnsupportedTokenExtension
    );
    require!(
        mint.data_len() == PLAIN_MINT_SIZE,
        ErrorCode::UnsupportedTokenExtension
    );
    Ok(())
}
pub fn validate_token_decimals(decimals: u8) -> Result<()> {
    require!(
        decimals >= MIN_TOKEN_DECIMALS && decimals <= MAX_TOKEN_DECIMALS,
        ErrorCode::InvalidDecimals
    );
    Ok(())
}

/// `10^exp` as `u128`, for `exp <= MAX_TOKEN_DECIMALS`.
pub fn pow10(exp: u8) -> Result<u128> {
    require!(exp <= MAX_TOKEN_DECIMALS, ErrorCode::InvalidDecimals);
    Ok(POW10_U128[exp as usize])
}

/// Convert a token amount between mint precisions. Truncates toward zero on down-scale.
pub fn convert_amount(amount: u64, from_decimals: u8, to_decimals: u8) -> Result<u64> {
    validate_token_decimals(from_decimals)?;
    validate_token_decimals(to_decimals)?;

    if from_decimals == to_decimals {
        return Ok(amount);
    }

    let amount = amount as u128;
    let result = if from_decimals < to_decimals {
        let factor = pow10(to_decimals - from_decimals)?;
        amount.checked_mul(factor).ok_or(ErrorCode::MathOverflow)?
    } else {
        let factor = pow10(from_decimals - to_decimals)?;
        amount.checked_div(factor).ok_or(ErrorCode::MathOverflow)?
    };

    u64::try_from(result).map_err(|_| ErrorCode::MathOverflow.into())
}

/// Apply mint haircut: `amount * (BPS_DENOM - haircut_bps) / BPS_DENOM`.
pub fn apply_mint_haircut(amount: u64, haircut_bps: u16) -> Result<u64> {
    require!(haircut_bps <= 10_000, ErrorCode::InvalidHaircut);
    let num = (amount as u128)
        .checked_mul((BPS_DENOM - haircut_bps as u64) as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(num
        .checked_div(BPS_DENOM as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64)
}

/// Apply redemption haircut: underlying out per wrapped token burned.
pub fn apply_redemption_haircut(amount: u64, haircut_bps: u16) -> Result<u64> {
    apply_mint_haircut(amount, haircut_bps)
}

/// Underlying atoms received → wrapped token atoms to mint (scale, then mint haircut).
pub fn underlying_to_wrapped_amount(
    underlying_amount: u64,
    underlying_decimals: u8,
    wrapped_decimals: u8,
    mint_haircut_bps: u16,
) -> Result<u64> {
    let scaled = convert_amount(underlying_amount, underlying_decimals, wrapped_decimals)?;
    apply_mint_haircut(scaled, mint_haircut_bps)
}

/// wrapped token atoms burned → underlying atoms to pay (scale, then redemption haircut).
pub fn wrapped_to_underlying_amount(
    wrapped_amount: u64,
    underlying_decimals: u8,
    wrapped_decimals: u8,
    redemption_haircut_bps: u16,
) -> Result<u64> {
    let scaled = convert_amount(wrapped_amount, wrapped_decimals, underlying_decimals)?;
    apply_redemption_haircut(scaled, redemption_haircut_bps)
}

/// Underlying atoms reserved to back outstanding pool liability (no redemption haircut).
pub fn liability_to_underlying_amount(
    liability_wstable: u64,
    underlying_decimals: u8,
    wrapped_decimals: u8,
) -> Result<u64> {
    convert_amount(liability_wstable, wrapped_decimals, underlying_decimals)
}

/// Tracked Kamino principal once `remaining` of `total_before` kTokens are left in the vault.
///
/// A redeem returns principal *and* accrued yield, so the liquidity received is not the amount
/// of principal that left. Principal instead scales with the surviving kToken share:
/// `principal * remaining / total_before`.
///
/// Rounds up so the retained principal is never understated — `harvest_yield` treats this value
/// as the floor that must stay in Kamino, and an understated floor would let a harvest pull
/// backing out as if it were yield. An empty pre-redeem balance is rejected rather than treated
/// as a full exit, so a corrupt state can never silently erase that floor.
pub fn remaining_klend_principal(principal: u64, remaining: u64, total_before: u64) -> Result<u64> {
    require!(
        total_before > 0,
        ErrorCode::InconsistentKlendCollateralBalance
    );
    require!(
        remaining <= total_before,
        ErrorCode::InconsistentKlendCollateralBalance
    );

    let scaled = (principal as u128)
        .checked_mul(remaining as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .div_ceil(total_before as u128);

    u64::try_from(scaled).map_err(|_| ErrorCode::MathOverflow.into())
}

/// Post-recall home vault surplus: `max(0, token_vault − liability_underlying − cushion)`.
pub fn home_surplus_amount(
    token_vault_balance: u64,
    liability_wstable: u64,
    underlying_decimals: u8,
    wrapped_decimals: u8,
    cushion: u64,
) -> Result<u64> {
    let liability_underlying =
        liability_to_underlying_amount(liability_wstable, underlying_decimals, wrapped_decimals)?;
    Ok(token_vault_balance
        .saturating_sub(liability_underlying)
        .saturating_sub(cushion))
}

const POW10_U128: [u128; 19] = [
    1,
    10,
    100,
    1_000,
    10_000,
    100_000,
    1_000_000,
    10_000_000,
    100_000_000,
    1_000_000_000,
    10_000_000_000,
    100_000_000_000,
    1_000_000_000_000,
    10_000_000_000_000,
    100_000_000_000_000,
    1_000_000_000_000_000,
    10_000_000_000_000_000,
    100_000_000_000_000_000,
    1_000_000_000_000_000_000,
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pow10_matches_literal() {
        assert_eq!(pow10(0).unwrap(), 1);
        assert_eq!(pow10(6).unwrap(), 1_000_000);
        assert_eq!(pow10(9).unwrap(), 1_000_000_000);
    }

    #[test]
    fn convert_same_decimals_is_identity() {
        assert_eq!(convert_amount(123, 6, 6).unwrap(), 123);
    }

    #[test]
    fn convert_scales_down_nine_to_six() {
        assert_eq!(convert_amount(1_000_000_000, 9, 6).unwrap(), 1_000_000);
    }

    #[test]
    fn convert_scales_up_six_to_nine() {
        assert_eq!(convert_amount(1_000_000, 6, 9).unwrap(), 1_000_000_000);
    }

    #[test]
    fn convert_truncates_toward_zero() {
        assert_eq!(convert_amount(1_500, 9, 6).unwrap(), 1);
        assert_eq!(convert_amount(999, 9, 6).unwrap(), 0);
    }

    #[test]
    fn underlying_to_wrapped_usdc_parity() {
        let out = underlying_to_wrapped_amount(1_000_000, 6, 6, 0).unwrap();
        assert_eq!(out, 1_000_000);
    }

    #[test]
    fn underlying_to_wrapped_nine_to_six() {
        let out = underlying_to_wrapped_amount(1_000_000_000, 9, 6, 0).unwrap();
        assert_eq!(out, 1_000_000);
    }

    #[test]
    fn mint_haircut_two_percent() {
        let out = underlying_to_wrapped_amount(1_000_000, 6, 6, 200).unwrap();
        assert_eq!(out, 980_000);
    }

    #[test]
    fn wrapped_to_underlying_with_haircut() {
        let out = wrapped_to_underlying_amount(1_000_000, 6, 6, 100).unwrap();
        assert_eq!(out, 990_000);
    }

    #[test]
    fn pow10_supports_eight_decimals() {
        assert_eq!(pow10(8).unwrap(), 100_000_000);
    }

    #[test]
    fn convert_eight_to_six_decimals() {
        // 1.00 unit @ 8dp → 1.00 unit @ 6dp
        assert_eq!(convert_amount(100_000_000, 8, 6).unwrap(), 1_000_000);
    }

    #[test]
    fn convert_six_to_eight_decimals() {
        assert_eq!(convert_amount(1_000_000, 6, 8).unwrap(), 100_000_000);
    }

    #[test]
    fn convert_eight_to_eight_parity() {
        assert_eq!(convert_amount(123_456_789, 8, 8).unwrap(), 123_456_789);
    }

    #[test]
    fn underlying_to_wrapped_eight_to_six() {
        let out = underlying_to_wrapped_amount(100_000_000, 8, 6, 0).unwrap();
        assert_eq!(out, 1_000_000);
    }

    #[test]
    fn wrapped_to_underlying_six_to_eight() {
        let out = wrapped_to_underlying_amount(1_000_000, 8, 6, 0).unwrap();
        assert_eq!(out, 100_000_000);
    }

    #[test]
    fn home_surplus_after_liability_and_cushion() {
        let surplus = home_surplus_amount(1_100_000, 1_000_000, 6, 6, 0).unwrap();
        assert_eq!(surplus, 100_000);
        let none = home_surplus_amount(900_000, 1_000_000, 6, 6, 0).unwrap();
        assert_eq!(none, 0);
    }

    #[test]
    fn remaining_principal_scales_with_ktoken_share() {
        // A quarter of the kTokens still held -> a quarter of the principal stays tracked.
        assert_eq!(remaining_klend_principal(1_000, 250, 1_000).unwrap(), 250);
    }

    #[test]
    fn remaining_principal_full_redeem_is_zero() {
        assert_eq!(remaining_klend_principal(1_000, 0, 1_000).unwrap(), 0);
    }

    #[test]
    fn remaining_principal_no_redeem_is_unchanged() {
        assert_eq!(
            remaining_klend_principal(1_000, 1_000, 1_000).unwrap(),
            1_000
        );
    }

    #[test]
    fn remaining_principal_rounds_up() {
        // 1000 * 2 / 3 == 666.67 -> 667, never 666.
        assert_eq!(remaining_klend_principal(1_000, 2, 3).unwrap(), 667);
    }

    #[test]
    fn remaining_principal_survives_u64_max() {
        // The u128 intermediate exists for this: principal * remaining overflows u64.
        assert_eq!(
            remaining_klend_principal(u64::MAX, u64::MAX, u64::MAX).unwrap(),
            u64::MAX
        );
        assert_eq!(
            remaining_klend_principal(u64::MAX, u64::MAX / 2, u64::MAX).unwrap(),
            u64::MAX / 2
        );
    }

    #[test]
    fn remaining_principal_ignores_accrued_yield() {
        // Regression: deposit 1000, position grows to 1100, recall half the kTokens so 500
        // remain. Subtracting liquidity_received (550) would leave 450 tracked while 500 is
        // still deployed, handing harvest_yield a 50-token slice of user backing.
        assert_eq!(remaining_klend_principal(1_000, 500, 1_000).unwrap(), 500);
    }

    #[test]
    fn remaining_principal_rejects_remaining_above_total() {
        assert!(remaining_klend_principal(1_000, 1_001, 1_000).is_err());
    }

    #[test]
    fn remaining_principal_rejects_zero_total() {
        // Zeroing the tracked principal here would hand harvest_yield an empty floor.
        assert!(remaining_klend_principal(1_000, 0, 0).is_err());
    }

    #[test]
    fn reject_zero_decimals() {
        assert!(validate_token_decimals(0).is_err());
    }

    #[test]
    fn convert_overflow_on_scale_up() {
        assert!(convert_amount(u64::MAX, 0, 1).is_err());
    }

    #[test]
    fn plain_mint_size_is_82() {
        assert_eq!(PLAIN_MINT_SIZE, 82);
    }
}
