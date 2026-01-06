use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::ErrorCode;
use crate::jupiter::JUPITER_PROGRAM_ID;
use crate::klend::KLEND_PROGRAM_ID;
use crate::state::VaultConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UnwrapArgs {
    pub amount: u64,
    pub min_out_amount: u64,
    pub collateral_amount: u64,
    pub swap_data: Option<Vec<u8>>,
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
    #[account(address = vault_config.base_mint)]
    pub base_mint: AccountInfo<'info>,

    /// CHECK: Base token config (USDC) - validated in handler
    #[account(mut)]
    pub base_token_config: AccountInfo<'info>,

    /// CHECK: Base token vault (receives redeemed USDC from KLend) - validated in handler
    #[account(mut)]
    pub base_token_vault: AccountInfo<'info>,

    /// CHECK: Base collateral vault (holds KLend kTokens) - validated in handler
    #[account(mut)]
    pub base_collateral_vault: AccountInfo<'info>,

    /// CHECK: KLend program
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(address = vault_config.lending_market)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: Base token KLend reserve - validated in handler
    #[account(mut)]
    pub base_reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: Reserve collateral mint - validated in handler
    #[account(mut)]
    pub reserve_collateral_mint: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: Collateral token program
    pub collateral_token_program: AccountInfo<'info>,

    /// CHECK: Instruction sysvar for KLend
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
    // Remaining accounts for additional token redemptions + Jupiter swap:
    // [jupiter_program, ...jupiter_route_accounts] (if swapping)
}

impl<'info> Unwrap<'info> {
    pub fn validate_jupiter(&self, remaining_accounts: &[AccountInfo<'info>]) -> Result<()> {
        if !remaining_accounts.is_empty() {
            let jupiter_program = &remaining_accounts[0];
            require!(
                jupiter_program.key() == JUPITER_PROGRAM_ID,
                ErrorCode::InvalidJupiterRoute
            );
        }
        Ok(())
    }

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
            user_base_token_mint == self.vault_config.base_mint,
            ErrorCode::InvalidTokenAccount
        );
        require!(
            user_base_token_owner == self.user.key(),
            ErrorCode::InvalidTokenAccount
        );

        Ok(())
    }

    /// Validate base_token_config PDA and extract fields needed for unwrap
    /// Returns (is_base_token, token_vault, collateral_vault, reserve, collateral_mint, total_deposited)
    pub fn validate_and_get_base_config(
        &self,
    ) -> Result<(bool, Pubkey, Pubkey, Pubkey, Pubkey, u64)> {
        // Verify PDA derivation
        let vault_config_key = self.vault_config.key();
        let base_mint = self.vault_config.base_mint;

        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[
                b"token_config",
                vault_config_key.as_ref(),
                base_mint.as_ref(),
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
        // bump: u8 (1)
        // vault_config: Pubkey (32)
        // token_mint: Pubkey (32)
        // token_decimals: u8 (1)
        // reserve: Pubkey (32)
        // collateral_mint: Pubkey (32)
        // collateral_vault: Pubkey (32)
        // collateral_vault_bump: u8 (1)
        // token_vault: Pubkey (32)
        // token_vault_bump: u8 (1)
        // total_deposited: u64 (8)
        // is_base_token: bool (1)
        // enabled: bool (1)

        let offset = 8; // discriminator
        let reserve =
            Pubkey::try_from(&config_data[offset + 1 + 32 + 32 + 1..offset + 1 + 32 + 32 + 1 + 32])
                .map_err(|_| ErrorCode::TokenNotFound)?;
        let collateral_mint = Pubkey::try_from(
            &config_data[offset + 1 + 32 + 32 + 1 + 32..offset + 1 + 32 + 32 + 1 + 32 + 32],
        )
        .map_err(|_| ErrorCode::TokenNotFound)?;
        let collateral_vault = Pubkey::try_from(
            &config_data
                [offset + 1 + 32 + 32 + 1 + 32 + 32..offset + 1 + 32 + 32 + 1 + 32 + 32 + 32],
        )
        .map_err(|_| ErrorCode::TokenNotFound)?;
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

        // Verify the provided accounts match
        require!(
            self.base_token_vault.key() == token_vault,
            ErrorCode::TokenNotFound
        );
        require!(
            self.base_collateral_vault.key() == collateral_vault,
            ErrorCode::TokenNotFound
        );
        require!(self.base_reserve.key() == reserve, ErrorCode::TokenNotFound);
        require!(
            self.reserve_collateral_mint.key() == collateral_mint,
            ErrorCode::TokenNotFound
        );

        Ok((
            is_base_token,
            token_vault,
            collateral_vault,
            reserve,
            collateral_mint,
            total_deposited,
        ))
    }
}
