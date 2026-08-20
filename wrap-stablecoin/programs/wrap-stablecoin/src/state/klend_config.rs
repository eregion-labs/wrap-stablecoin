use anchor_lang::prelude::*;

/// Kamino KLend integration for a registered asset. PDA seeds: `["klend_config", asset_config]`.
#[account]
#[derive(InitSpace)]
pub struct KLendConfig {
    pub bump: u8,
    pub asset_config: Pubkey,
    pub lending_market: Pubkey,
    pub reserve: Pubkey,
    pub reserve_liquidity_supply: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub collateral_vault_bump: u8,
    /// USDC-denominated principal deployed to KLend for this asset.
    pub total_liquidity_in_klend: u64,
}

impl KLendConfig {
    /// Retire the share of principal matching the fraction of kTokens redeemed.
    ///
    /// A redeem returns principal *plus* the yield accrued on the redeemed kTokens, so
    /// subtracting the full liquidity received would under-count remaining principal and
    /// let `harvest_yield` draw real backing into the treasury. Scaling by the kToken
    /// fraction keeps the tracked figure aligned with the principal still deployed.
    ///
    /// Truncating division retires slightly less than the exact share, which keeps
    /// `total_liquidity_in_klend` at or above the true principal — the conservative
    /// direction for the harvest backing check.
    pub fn retire_principal(&mut self, ktokens_redeemed: u64, ktokens_before: u64) -> Result<()> {
        require!(
            ktokens_before > 0 && ktokens_redeemed <= ktokens_before,
            crate::errors::ErrorCode::InvalidAmount
        );

        let retired = (self.total_liquidity_in_klend as u128)
            .checked_mul(ktokens_redeemed as u128)
            .ok_or(crate::errors::ErrorCode::MathOverflow)?
            .checked_div(ktokens_before as u128)
            .ok_or(crate::errors::ErrorCode::MathOverflow)?;

        // `ktokens_redeemed <= ktokens_before` bounds `retired` by the current principal.
        let retired = u64::try_from(retired).map_err(|_| crate::errors::ErrorCode::MathOverflow)?;
        self.total_liquidity_in_klend = self.total_liquidity_in_klend.saturating_sub(retired);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(principal: u64) -> KLendConfig {
        KLendConfig {
            bump: 0,
            asset_config: Pubkey::default(),
            lending_market: Pubkey::default(),
            reserve: Pubkey::default(),
            reserve_liquidity_supply: Pubkey::default(),
            collateral_mint: Pubkey::default(),
            collateral_vault: Pubkey::default(),
            collateral_vault_bump: 0,
            total_liquidity_in_klend: principal,
        }
    }

    #[test]
    fn full_redeem_retires_all_principal() {
        let mut c = config(1_000);
        c.retire_principal(1_000, 1_000).unwrap();
        assert_eq!(c.total_liquidity_in_klend, 0);
    }

    #[test]
    fn half_redeem_retires_half_principal_not_liquidity() {
        // 1000 principal, kTokens now worth 1100. Redeeming half the kTokens returns
        // 550 liquidity, but only 500 of that is principal.
        let mut c = config(1_000);
        c.retire_principal(500, 1_000).unwrap();
        assert_eq!(c.total_liquidity_in_klend, 500);
    }

    #[test]
    fn repeated_partial_redeems_do_not_drift_below_principal() {
        let mut c = config(1_000);
        // Three successive quarter-redeems of the remaining kToken balance.
        c.retire_principal(250, 1_000).unwrap(); // 750 left
        c.retire_principal(250, 750).unwrap(); // 500 left
        c.retire_principal(250, 500).unwrap(); // 250 left
        assert_eq!(c.total_liquidity_in_klend, 250);
    }

    #[test]
    fn zero_redeem_leaves_principal_untouched() {
        let mut c = config(1_000);
        c.retire_principal(0, 1_000).unwrap();
        assert_eq!(c.total_liquidity_in_klend, 1_000);
    }

    #[test]
    fn truncation_rounds_in_favour_of_backing() {
        // 1 of 3 kTokens redeemed against principal 10 => exact share 3.33, retire 3.
        let mut c = config(10);
        c.retire_principal(1, 3).unwrap();
        assert_eq!(c.total_liquidity_in_klend, 7);
    }

    #[test]
    fn rejects_empty_or_oversized_redeem() {
        assert!(config(1_000).retire_principal(1, 0).is_err());
        assert!(config(1_000).retire_principal(2, 1).is_err());
    }
}
