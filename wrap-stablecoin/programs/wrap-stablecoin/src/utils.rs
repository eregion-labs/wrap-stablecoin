use anchor_lang::prelude::*;
use anchor_spl::token::ID as SPL_TOKEN_ID;
use anchor_spl::token_2022;

use crate::errors::ErrorCode;

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
