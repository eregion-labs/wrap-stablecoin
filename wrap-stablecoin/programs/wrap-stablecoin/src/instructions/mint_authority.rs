use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::Mint;

use crate::errors::ErrorCode;
use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct ProposeMintAuthority<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized,
        constraint = !vault_config.mint_authority_transferred @ ErrorCode::MintAuthorityAlreadyTransferred
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: Proposed new SPL mint authority (wallet or program PDA).
    pub new_mint_authority: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelProposeMintAuthority<'info> {
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
pub struct AcceptMintAuthority<'info> {
    #[account(mut)]
    pub new_mint_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        constraint = !vault_config.mint_authority_transferred @ ErrorCode::MintAuthorityAlreadyTransferred,
        constraint = vault_config.pending_mint_authority == new_mint_authority.key() @ ErrorCode::NoPendingMintAuthorityTransfer
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        address = vault_config.wrapped_mint,
        constraint = wrapped_mint.decimals == vault_config.wrapped_decimals @ ErrorCode::InvalidDecimals
    )]
    pub wrapped_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: PDA that currently holds SPL mint authority.
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump
    )]
    pub vault_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}
