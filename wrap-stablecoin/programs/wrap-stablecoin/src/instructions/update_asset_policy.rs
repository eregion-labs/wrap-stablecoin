use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{AssetConfig, AssetStatus, VaultConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateAssetPolicyArgs {
    pub mint_enabled: bool,
    pub redeem_enabled: bool,
    pub mint_haircut_bps: u16,
    pub redemption_haircut_bps: u16,
    pub mint_cap: u64,
    pub exposure_cap: u64,
    pub min_liquidity_target: u64,
    pub asset_status: AssetStatus,
}

#[derive(Accounts)]
pub struct UpdateAssetPolicy<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [crate::pda_seeds::ASSET_CONFIG_SEED, vault_config.key().as_ref(), asset_config.token_mint.as_ref()],
        bump = asset_config.bump,
        constraint = vault_config.has_asset(&asset_config.token_mint) @ ErrorCode::AssetNotRegistered
    )]
    pub asset_config: Account<'info, AssetConfig>,
}
