use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::CreateMetadataAccountV3CpiBuilder;
use mpl_token_metadata::types::DataV2;
use mpl_token_metadata::ID as TOKEN_METADATA_PROGRAM_ID;

use crate::errors::ErrorCode;
use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct InitializeMintMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [crate::pda_seeds::VAULT_CONFIG_SEED, vault_config.authority.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: PDA mint authority for wrapped mint operations.
    #[account(
        seeds = [crate::pda_seeds::VAULT_AUTHORITY_SEED, vault_config.key().as_ref()],
        bump = vault_config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// CHECK: Wrapped mint PDA owned by this program.
    #[account(address = vault_config.wrapped_mint @ ErrorCode::InvalidTokenAccount)]
    pub wrapped_mint: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata PDA for `wrapped_mint` (created by CPI).
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex Token Metadata program.
    #[account(address = TOKEN_METADATA_PROGRAM_ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_mint_metadata_handler(
    ctx: Context<InitializeMintMetadata>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    require!(name.len() <= 32, ErrorCode::InvalidMetadata);
    require!(symbol.len() <= 10, ErrorCode::InvalidMetadata);
    require!(uri.len() <= 200, ErrorCode::InvalidMetadata);
    require!(!uri.is_empty(), ErrorCode::InvalidMetadata);

    let (expected_metadata, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            TOKEN_METADATA_PROGRAM_ID.as_ref(),
            ctx.accounts.wrapped_mint.key().as_ref(),
        ],
        &TOKEN_METADATA_PROGRAM_ID,
    );
    require!(
        ctx.accounts.metadata.key() == expected_metadata,
        ErrorCode::InvalidMetadataAccount
    );
    require!(
        ctx.accounts.metadata.data_is_empty(),
        ErrorCode::MetadataAlreadyInitialized
    );

    let vault_config_key = ctx.accounts.vault_config.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        crate::pda_seeds::VAULT_AUTHORITY_SEED,
        vault_config_key.as_ref(),
        &[ctx.accounts.vault_config.vault_authority_bump],
    ]];

    let data = DataV2 {
        name,
        symbol,
        uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    CreateMetadataAccountV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(&ctx.accounts.metadata)
        .mint(&ctx.accounts.wrapped_mint.to_account_info())
        .mint_authority(&ctx.accounts.vault_authority.to_account_info())
        .payer(&ctx.accounts.authority.to_account_info())
        .update_authority(&ctx.accounts.authority.to_account_info(), true)
        .system_program(&ctx.accounts.system_program.to_account_info())
        .data(data)
        .is_mutable(true)
        .invoke_signed(signer_seeds)?;

    msg!("Mint metadata initialized");
    Ok(())
}
