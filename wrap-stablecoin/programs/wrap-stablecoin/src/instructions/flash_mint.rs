use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::errors::ErrorCode;
use crate::state::{FlashLoanState, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct FlashMintStartArgs {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: FlashMintStartArgs)]
pub struct FlashMintStart<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        constraint = !vault_config.paused @ ErrorCode::VaultPaused,
        constraint = vault_config.flash_mint_enabled || borrower.key() == vault_config.admin @ ErrorCode::FlashMintDisabled
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        init,
        payer = borrower,
        space = 8 + FlashLoanState::INIT_SPACE,
        seeds = [crate::pda_seeds::FLASH_LOAN_SEED, borrower.key().as_ref(), vault_config.key().as_ref()],
        bump
    )]
    pub flash_loan_state: Account<'info, FlashLoanState>,

    /// CHECK: PDA authority for signing mint
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(mut, address = vault_config.wrapped_mint)]
    pub wrapped_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = borrower_wrapped.mint == vault_config.wrapped_mint,
        constraint = borrower_wrapped.owner == borrower.key()
    )]
    pub borrower_wrapped: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,

    /// CHECK: Instructions sysvar for transaction introspection
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct FlashMintEnd<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        close = borrower,
        seeds = [crate::pda_seeds::FLASH_LOAN_SEED, borrower.key().as_ref(), vault_config.key().as_ref()],
        bump = flash_loan_state.bump,
        constraint = flash_loan_state.borrower == borrower.key() @ ErrorCode::InvalidFlashLoan,
        constraint = flash_loan_state.vault_config == vault_config.key() @ ErrorCode::InvalidFlashLoan
    )]
    pub flash_loan_state: Account<'info, FlashLoanState>,

    #[account(mut, address = vault_config.wrapped_mint)]
    pub wrapped_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = borrower_wrapped.mint == vault_config.wrapped_mint,
        constraint = borrower_wrapped.owner == borrower.key()
    )]
    pub borrower_wrapped: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = fee_receiver.mint == vault_config.wrapped_mint @ ErrorCode::InvalidTokenAccount,
        constraint = fee_receiver.key() == vault_config.flash_mint_fee_receiver @ ErrorCode::Unauthorized
    )]
    pub fee_receiver: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SetFlashMintFee<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct SetFlashMintEnabled<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct SetFlashMintMaxAmount<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct SetFlashMintFeeReceiver<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// Token account that will receive flash-mint fees. Must hold the wrapped mint.
    #[account(
        constraint = fee_receiver.mint == vault_config.wrapped_mint @ ErrorCode::InvalidTokenAccount
    )]
    pub fee_receiver: InterfaceAccount<'info, TokenAccount>,
}

/// Max forward scan for the matching flash_mint_end in the current transaction. A v0 tx can
/// hold ~60 top-level instructions; 64 is a generous upper bound that keeps CU predictable.
const FLASH_MINT_SCAN_LIMIT: usize = 64;

pub fn verify_flash_mint_end_exists(
    instruction_sysvar: &AccountInfo,
    borrower: &Pubkey,
    vault_config: &Pubkey,
    flash_loan_state: &Pubkey,
    wrapped_mint: &Pubkey,
    program_id: &Pubkey,
) -> Result<()> {
    let current_index = load_current_index_checked(instruction_sysvar)
        .map_err(|_| ErrorCode::MissingFlashMintEnd)?;

    let discriminator: [u8; 8] = anchor_sighash("flash_mint_end");

    let start = current_index as usize + 1;
    for offset in 0..FLASH_MINT_SCAN_LIMIT {
        let index = start + offset;
        match load_instruction_at_checked(index, instruction_sysvar) {
            Ok(ix) => {
                // Accounts order in FlashMintEnd:
                //   [0] borrower, [1] vault_config, [2] flash_loan_state,
                //   [3] wrapped_mint, [4] borrower_wrapped, [5] fee_receiver, [6] token_program
                if ix.program_id == *program_id
                    && ix.data.len() >= 8
                    && ix.data[..8] == discriminator
                    && ix.accounts.len() >= 4
                    && ix.accounts[0].pubkey == *borrower
                    && ix.accounts[1].pubkey == *vault_config
                    && ix.accounts[2].pubkey == *flash_loan_state
                    && ix.accounts[3].pubkey == *wrapped_mint
                {
                    return Ok(());
                }
            }
            Err(_) => return Err(ErrorCode::MissingFlashMintEnd.into()),
        }
    }

    Err(ErrorCode::FlashMintScanLimit.into())
}

fn anchor_sighash(name: &str) -> [u8; 8] {
    use sha2::{Digest, Sha256};
    let preimage = format!("global:{}", name);
    let mut hasher = Sha256::new();
    hasher.update(preimage.as_bytes());
    let result = hasher.finalize();
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&result[..8]);
    sighash
}
