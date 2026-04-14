use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: New treasury address
    pub new_treasury: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: New authority address
    pub new_authority: AccountInfo<'info>,
}
