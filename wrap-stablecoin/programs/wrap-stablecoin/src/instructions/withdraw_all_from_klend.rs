use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::constants::LENDING_MARKET_AUTH_SEED;
use crate::errors::ErrorCode;
use crate::klend::KLEND_PROGRAM_ID;
use crate::state::{AssetConfig, KLendConfig, VaultConfig};

#[derive(Accounts)]
pub struct WithdrawAllFromKlend<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Box<Account<'info, VaultConfig>>,

    /// CHECK: PDA authority for signing KLend CPI
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    #[account(
        seeds = [crate::pda_seeds::ASSET_CONFIG_SEED, vault_config.key().as_ref(), asset_config.token_mint.as_ref()],
        bump = asset_config.bump,
        constraint = vault_config.has_asset(&asset_config.token_mint) @ ErrorCode::AssetNotRegistered
    )]
    pub asset_config: Box<Account<'info, AssetConfig>>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::KLEND_CONFIG_SEED, asset_config.key().as_ref()],
        bump = klend_config.bump,
        constraint = klend_config.asset_config == asset_config.key() @ ErrorCode::KlendNotEnabled
    )]
    pub klend_config: Box<Account<'info, KLendConfig>>,

    /// CHECK: Token vault - receives redeemed liquidity
    #[account(mut, address = asset_config.token_vault)]
    pub token_vault: AccountInfo<'info>,

    /// CHECK: Underlying mint
    #[account(address = asset_config.token_mint)]
    pub token_mint: AccountInfo<'info>,

    /// CHECK: KLend program
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: AccountInfo<'info>,

    /// CHECK: KLend lending market
    #[account(address = klend_config.lending_market)]
    pub lending_market: AccountInfo<'info>,

    /// CHECK: KLend lending market authority PDA
    #[account(
        seeds = [LENDING_MARKET_AUTH_SEED, klend_config.lending_market.as_ref()],
        bump,
        seeds::program = KLEND_PROGRAM_ID
    )]
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: KLend reserve
    #[account(mut, address = klend_config.reserve)]
    pub reserve: AccountInfo<'info>,

    /// CHECK: Reserve liquidity supply
    #[account(mut, address = klend_config.reserve_liquidity_supply)]
    pub reserve_liquidity_supply: AccountInfo<'info>,

    /// CHECK: Reserve collateral mint
    #[account(mut, address = klend_config.collateral_mint)]
    pub reserve_collateral_mint: AccountInfo<'info>,

    /// CHECK: Collateral vault (kTokens)
    #[account(mut, address = klend_config.collateral_vault)]
    pub collateral_vault: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: Collateral token program
    pub collateral_token_program: AccountInfo<'info>,

    /// CHECK: Instruction sysvar for KLend
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,
}
