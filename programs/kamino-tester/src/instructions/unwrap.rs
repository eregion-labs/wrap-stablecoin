use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::ErrorCode;
use crate::state::VaultConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UnwrapArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Unwrap<'info> {
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

    /// CHECK: User's wrapped token account - validated in handler
    #[account(mut)]
    pub user_wrapped: AccountInfo<'info>,

    /// CHECK: User's base token (USDC) destination - validated in handler
    #[account(mut)]
    pub user_base_token: AccountInfo<'info>,

    /// CHECK: Wrapped mint - validated via vault_config
    #[account(mut, address = vault_config.wrapped_mint)]
    pub wrapped_mint: AccountInfo<'info>,

    /// CHECK: Base token mint (USDC)
    #[account(address = vault_config.usdc_mint)]
    pub usdc_mint: AccountInfo<'info>,

    /// CHECK: Base token config (USDC) - validated in handler
    #[account(mut)]
    pub base_token_config: AccountInfo<'info>,

    /// CHECK: Base token vault - validated in handler
    #[account(mut)]
    pub base_token_vault: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Unwrap<'info> {
    pub fn validate_user_accounts(&self) -> Result<()> {
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
        drop(user_wrapped_data);

        // Validate user_base_token: check mint and owner from raw data
        let user_base_token_data = self.user_base_token.try_borrow_data()?;
        require!(
            user_base_token_data.len() >= 72,
            ErrorCode::InvalidTokenAccount
        );
        let user_base_token_mint = Pubkey::try_from(&user_base_token_data[0..32])
            .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        let user_base_token_owner = Pubkey::try_from(&user_base_token_data[32..64])
            .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        require!(
            user_base_token_mint == self.vault_config.usdc_mint,
            ErrorCode::InvalidTokenAccount
        );
        require!(
            user_base_token_owner == self.user.key(),
            ErrorCode::InvalidTokenAccount
        );

        Ok(())
    }

    /// Validate base_token_config PDA and extract fields needed for unwrap
    /// Returns (token_vault, total_deposited, token_decimals)
    pub fn validate_and_get_base_config(
        &self,
    ) -> Result<(Pubkey, u64, u8)> {
        // Verify PDA derivation
        let vault_config_key = self.vault_config.key();
        let usdc_mint = self.vault_config.usdc_mint;

        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[
                b"token_config",
                vault_config_key.as_ref(),
                usdc_mint.as_ref(),
            ],
            &crate::ID,
        );
        require!(
            self.base_token_config.key() == expected_pda,
            ErrorCode::TokenNotFound
        );

        // Read token_config data (skip 8-byte discriminator)
        let config_data = self.base_token_config.try_borrow_data()?;
        require!(
            config_data.len() >= 8 + 1 + 32 + 32 + 1 + 32 + 32 + 32 + 1 + 32 + 1 + 8 + 1 + 1,
            ErrorCode::TokenNotFound
        );

        // TokenConfig layout after discriminator:
        // bump: u8 (1), vault_config: Pubkey (32), token_mint: Pubkey (32), token_decimals: u8 (1)
        // reserve: Pubkey (32), collateral_mint: Pubkey (32), collateral_vault: Pubkey (32)
        // collateral_vault_bump: u8 (1), token_vault: Pubkey (32), token_vault_bump: u8 (1)
        // total_deposited: u64 (8), is_base_token: bool (1), enabled: bool (1)

        let offset = 8;
        let token_decimals = config_data[offset + 1 + 32 + 32];
        let token_vault = Pubkey::try_from(
            &config_data[offset + 1 + 32 + 32 + 1 + 32 + 32 + 32 + 1
                ..offset + 1 + 32 + 32 + 1 + 32 + 32 + 32 + 1 + 32],
        )
        .map_err(|_| ErrorCode::TokenNotFound)?;

        let total_deposited_offset = offset + 1 + 32 + 32 + 1 + 32 + 32 + 32 + 1 + 32 + 1;
        let total_deposited = u64::from_le_bytes(
            config_data[total_deposited_offset..total_deposited_offset + 8]
                .try_into()
                .map_err(|_| ErrorCode::TokenNotFound)?,
        );

        let is_base_token = config_data[total_deposited_offset + 8] != 0;
        require!(is_base_token, ErrorCode::TokenNotFound);

        require!(
            self.base_token_vault.key() == token_vault,
            ErrorCode::TokenNotFound
        );

        Ok((token_vault, total_deposited, token_decimals))
    }
}
