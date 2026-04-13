use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::ErrorCode;
use crate::klend::KLEND_PROGRAM_ID;
use crate::state::{TokenConfig, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WrapArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        constraint = !vault_config.paused @ ErrorCode::VaultPaused
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA authority for signing
    #[account(
        seeds = [b"vault_authority", vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"token_config", vault_config.key().as_ref(), token_config.token_mint.as_ref()],
        bump = token_config.bump,
        constraint = token_config.enabled @ ErrorCode::TokenDisabled
    )]
    pub token_config: Account<'info, TokenConfig>,

    /// CHECK: Input token mint
    #[account(address = token_config.token_mint)]
    pub token_mint: AccountInfo<'info>,

    /// CHECK: User's input token account - validated in handler
    #[account(mut)]
    pub user_token: AccountInfo<'info>,

    /// CHECK: User's wrapped token account - validated in handler
    #[account(mut)]
    pub user_wrapped: AccountInfo<'info>,

    /// CHECK: Wrapped mint - validated via vault_config
    #[account(mut, address = vault_config.wrapped_mint)]
    pub wrapped_mint: AccountInfo<'info>,

    /// CHECK: Token vault for intermediate storage - validated via token_config
    #[account(mut, address = token_config.token_vault)]
    pub token_vault: AccountInfo<'info>,

    /// CHECK: Base token mint (USDC)
    #[account(address = vault_config.base_mint)]
    pub base_mint: AccountInfo<'info>,

    /// CHECK: KLend program
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(address = vault_config.lending_market)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: Base token KLend reserve - validated via token_config
    #[account(mut, address = token_config.reserve)]
    pub base_reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply - validated via token_config
    #[account(mut, address = token_config.reserve_liquidity_supply)]
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: Reserve collateral mint - validated via token_config
    #[account(mut, address = token_config.collateral_mint)]
    pub reserve_collateral_mint: AccountInfo<'info>,

    /// CHECK: Base token collateral vault - validated via token_config
    #[account(mut, address = token_config.collateral_vault)]
    pub base_collateral_vault: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: Collateral token program
    pub collateral_token_program: AccountInfo<'info>,

    /// CHECK: Instruction sysvar for KLend
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
}

impl<'info> Wrap<'info> {
    pub fn validate_user_accounts(&self) -> Result<()> {
        // Validate user_token: check mint and owner from raw data
        let user_token_data = self.user_token.try_borrow_data()?;
        require!(user_token_data.len() >= 72, ErrorCode::InvalidTokenAccount);
        let user_token_mint = Pubkey::try_from(&user_token_data[0..32])
            .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        let user_token_owner = Pubkey::try_from(&user_token_data[32..64])
            .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        require!(
            user_token_mint == self.token_config.token_mint,
            ErrorCode::InvalidTokenAccount
        );
        require!(
            user_token_owner == self.user.key(),
            ErrorCode::InvalidTokenAccount
        );
        drop(user_token_data);

        // Validate user_wrapped: check mint and owner from raw data
        let user_wrapped_data = self.user_wrapped.try_borrow_data()?;
        require!(
            user_wrapped_data.len() >= 72,
            ErrorCode::InvalidTokenAccount
        );
        let user_wrapped_mint = Pubkey::try_from(&user_wrapped_data[0..32])
            .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        let user_wrapped_owner = Pubkey::try_from(&user_wrapped_data[32..64])
            .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        require!(
            user_wrapped_mint == self.vault_config.wrapped_mint,
            ErrorCode::InvalidTokenAccount
        );
        require!(
            user_wrapped_owner == self.user.key(),
            ErrorCode::InvalidTokenAccount
        );

        Ok(())
    }
}
