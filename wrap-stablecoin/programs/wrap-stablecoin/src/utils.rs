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

/// Reject zero or out-of-range mint precisions.
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
        amount
            .checked_mul(factor)
            .ok_or(ErrorCode::MathOverflow)?
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

/// Apply redemption haircut: underlying out per wStable burned.
pub fn apply_redemption_haircut(amount: u64, haircut_bps: u16) -> Result<u64> {
    apply_mint_haircut(amount, haircut_bps)
}

/// Underlying atoms received → wStable atoms to mint (scale, then mint haircut).
pub fn underlying_to_wrapped_amount(
    underlying_amount: u64,
    underlying_decimals: u8,
    wrapped_decimals: u8,
    mint_haircut_bps: u16,
) -> Result<u64> {
    let scaled = convert_amount(
        underlying_amount,
        underlying_decimals,
        wrapped_decimals,
    )?;
    apply_mint_haircut(scaled, mint_haircut_bps)
}

/// wStable atoms burned → underlying atoms to pay (scale, then redemption haircut).
pub fn wrapped_to_underlying_amount(
    wrapped_amount: u64,
    underlying_decimals: u8,
    wrapped_decimals: u8,
    redemption_haircut_bps: u16,
) -> Result<u64> {
    let scaled = convert_amount(
        wrapped_amount,
        wrapped_decimals,
        underlying_decimals,
    )?;
    apply_redemption_haircut(scaled, redemption_haircut_bps)
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
    fn reject_zero_decimals() {
        assert!(validate_token_decimals(0).is_err());
    }

    #[test]
    fn convert_overflow_on_scale_up() {
        assert!(convert_amount(u64::MAX, 0, 1).is_err());
    }
}
