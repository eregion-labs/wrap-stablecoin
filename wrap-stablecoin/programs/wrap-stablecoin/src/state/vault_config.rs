use anchor_lang::prelude::*;

/// Pinned rather than derived from the type name, because the field layout below changed after
/// vaults were already live: `asset_count: u8` and `registered_assets: [Pubkey; 8]` sat between
/// `vault_authority_bump` and `total_stable_deposited`, so dropping them moved every field from
/// `total_stable_deposited` onward 257 bytes earlier. Everything up to `vault_authority_bump`
/// still lands on its old offset, `admin` included, which is what makes the break easy to miss.
///
/// A name-derived discriminator is identical either side of that change, so Anchor would hand an
/// old-layout account straight to Borsh. On a vault with an empty registry the shifted bytes are
/// all zero, Borsh ignores the 257 trailing bytes, and it decodes with no error at all into a
/// garbage `total_stable_deposited`, `paused`, `wrap_public` and `mint_authority_transferred`. On
/// a vault with assets registered a shifted mint byte is almost never a valid `bool`, so it fails
/// as `AccountDidNotDeserialize`, which points at the wrong problem. Pinning the discriminator
/// turns both cases into one honest `AccountDiscriminatorMismatch`.
///
/// There is no migration: a vault created before this change cannot be read or repaired, and the
/// program must be pointed at a freshly initialized vault. Bump the trailing digit on any future
/// change that moves or removes an existing field.
pub const VAULT_CONFIG_DISCRIMINATOR: [u8; 8] = *b"vaultcf2";

#[account(discriminator = &VAULT_CONFIG_DISCRIMINATOR)]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub bump: u8,
    /// Immutable creator key used in PDA seeds. Never changes after init.
    pub authority: Pubkey,
    /// Mutable operational admin. Can be transferred via two-step process.
    pub admin: Pubkey,
    /// Pending admin for two-step authority transfer. Default means no pending transfer.
    pub pending_admin: Pubkey,
    pub wrapped_mint: Pubkey,
    pub wrapped_mint_bump: u8,
    /// Decimal precision of `wrapped_mint` (fixed at initialize).
    pub wrapped_decimals: u8,
    pub vault_authority_bump: u8,
    /// Global wrapped token liability counter (wraps − unwraps).
    pub total_stable_deposited: u64,
    pub paused: bool,
    pub wrap_public: bool,
    pub unwrap_public: bool,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_enabled: bool,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_fee_bps: u16,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_max_amount: u64,
    /// Reserved for optional `flash-mint` feature; unused in shipped build.
    pub flash_mint_fee_receiver: Pubkey,
    /// Pending destination for two-step mint authority transfer. Default means no pending transfer.
    pub pending_mint_authority: Pubkey,
    /// When true, SPL mint authority has left this vault and `wrap` is permanently disabled.
    pub mint_authority_transferred: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::Discriminator;

    /// sha256("account:VaultConfig")[..8], the discriminator `#[account]` derives from the type
    /// name when no override is given. An old-layout vault carries exactly these bytes.
    const NAME_DERIVED: [u8; 8] = [99, 86, 43, 216, 184, 102, 119, 77];

    /// The override has to reach `Discriminator`, which is what `try_deserialize` and
    /// `try_serialize` read. Dropping `discriminator = ...` from `#[account]` fails here.
    /// The length matters too: `initialize` allocates `8 + VaultConfig::INIT_SPACE`, so any
    /// other length would silently mis-size the account.
    #[test]
    fn discriminator_is_the_pinned_eight_bytes() {
        assert_eq!(VaultConfig::DISCRIMINATOR, VAULT_CONFIG_DISCRIMINATOR);
        assert_eq!(VaultConfig::DISCRIMINATOR.len(), 8);
    }

    /// The pin only makes the layout break loud while it stays distinct from the name-derived
    /// value; if the two ever coincided, an old-layout vault would decode silently again.
    #[test]
    fn pinned_discriminator_differs_from_name_derived() {
        assert_ne!(VAULT_CONFIG_DISCRIMINATOR, NAME_DERIVED);
        assert_ne!(VaultConfig::DISCRIMINATOR, NAME_DERIVED);
    }
}
