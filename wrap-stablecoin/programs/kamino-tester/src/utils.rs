use anchor_lang::prelude::*;

/// Read the raw SPL Token / Token-2022 amount field (offset 64..72) from a token account.
/// Used for fresh balance reads post-CPI, where cached `InterfaceAccount::amount` would be stale.
pub fn get_token_balance(token_account: &AccountInfo) -> Result<u64> {
    let data = token_account.try_borrow_data()?;
    if data.len() < 72 {
        return Err(ProgramError::InvalidAccountData.into());
    }
    let amount = u64::from_le_bytes(
        data[64..72]
            .try_into()
            .map_err(|_| ProgramError::InvalidAccountData)?,
    );
    Ok(amount)
}
