use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{Allowlist, VaultConfig};

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: New treasury address
    pub new_treasury: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: Proposed new admin address
    pub new_admin: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(mut)]
    pub new_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        constraint = vault_config.pending_admin == new_admin.key() @ ErrorCode::NoPendingTransfer
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct SetWrapPublic<'info> {
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
pub struct SetUnwrapPublic<'info> {
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
pub struct InitAllowlist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Allowlist::INIT_SPACE,
        seeds = [b"allowlist", vault_config.key().as_ref()],
        bump
    )]
    pub allowlist: Account<'info, Allowlist>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddToAllowlist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [b"allowlist", vault_config.key().as_ref()],
        bump = allowlist.bump
    )]
    pub allowlist: Account<'info, Allowlist>,
}

#[derive(Accounts)]
pub struct RemoveFromAllowlist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault_config", vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [b"allowlist", vault_config.key().as_ref()],
        bump = allowlist.bump
    )]
    pub allowlist: Account<'info, Allowlist>,
}
