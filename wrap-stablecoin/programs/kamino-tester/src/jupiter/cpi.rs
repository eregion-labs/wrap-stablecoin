use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

pub use crate::constants::JUPITER_PROGRAM_ID;

/// Execute a Jupiter swap using raw instruction data from the client.
/// The client should fetch the swap route from Jupiter API and pass the instruction data.
///
/// # Arguments
/// * `jupiter_program` - Jupiter program account
/// * `remaining_accounts` - All accounts required by the Jupiter swap (from Jupiter API response)
/// * `authority_seeds` - Seeds for PDA signing
/// * `swap_data` - Raw Jupiter instruction data (from Jupiter API)
pub fn execute_swap_with_data<'info>(
    jupiter_program: &AccountInfo<'info>,
    remaining_accounts: &[AccountInfo<'info>],
    authority_seeds: &[&[u8]],
    swap_data: Vec<u8>,
) -> Result<()> {
    let accounts: Vec<AccountMeta> = remaining_accounts
        .iter()
        .map(|acc| {
            if acc.is_writable {
                AccountMeta::new(*acc.key, acc.is_signer)
            } else {
                AccountMeta::new_readonly(*acc.key, acc.is_signer)
            }
        })
        .collect();

    let ix = Instruction {
        program_id: jupiter_program.key(),
        accounts,
        data: swap_data,
    };

    let account_infos: Vec<AccountInfo> = remaining_accounts.to_vec();

    invoke_signed(&ix, &account_infos, &[authority_seeds])?;

    Ok(())
}

/// Get the balance of a token account
pub fn get_token_balance(token_account: &AccountInfo) -> Result<u64> {
    let data = token_account.try_borrow_data()?;
    if data.len() < 72 {
        return Err(ProgramError::InvalidAccountData.into());
    }
    // Token account amount is at offset 64 (after mint and owner pubkeys)
    let amount = u64::from_le_bytes(data[64..72].try_into().unwrap());
    Ok(amount)
}
