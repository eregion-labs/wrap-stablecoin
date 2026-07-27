/** User-facing vocabulary — treasury office (admin). */
export const adminCopy = {
  officeTitle: "Treasury Office",
  treasury: "Treasury",
  chamber: "Chamber",
  tokenStats: "Token Stats",
  treasuryPageTitle: "Treasury",
  treasuryPageDescription: (wrappedName: string, wrappedSymbol: string) =>
    `Issue ${wrappedName} from reserve collateral held by the treasury signer, or redeem ${wrappedSymbol} for underlying. The backend composes, signs, and submits transactions. Amounts are in smallest on-chain units.`,
  treasurySigner: "Treasury signer",
  treasuryOperations: "Treasury operations",
  reserveGovernance: "Reserve governance",
  tokenStatsSubtitle: "Token address & holders",
  tokenStatsPageTitle: "Token Stats",
  tokenStatsPageDescription: (wrappedName: string, wrappedSymbol: string) =>
    `${wrappedName} (${wrappedSymbol}) mint metadata and largest token-account holders from the treasury API.`,
  tokenContract: "Token Contract",
  decimals: "Decimals",
  holdersBreakdown: "Token Holders Breakdown",
  holdersCaption:
    "Top five token accounts by balance; remaining supply rolled into Others. Addresses are SPL token accounts.",
  holdersOthers: "Others",
  holdersEmpty: "No holder balances reported yet.",
  refreshHolders: "Refresh holders",
  accounts: "Accounts",
  accountsCaption:
    "Per-pool reserves, liability, and redeemable capacity. Figures in token base units unless noted.",
  issueViaTreasury: "Issue via treasury",
  redeemViaTreasury: "Redeem via treasury",
  submitting: "Submitting…",
  refreshLedger: "Refresh ledger",
  reserveGovernanceSubtitle: "Reserve governance",
  collateralPolicy: "Reserve governance",
  tabMint: "Mint Florin",
  tabRedeem: "Redeem Florin",
  reserveCollateral: "Reserve collateral",
  collateralAmount: "Collateral amount (base units)",
  redeemAmount: (symbol: string) => `${symbol} amount to redeem`,
  pausedVaultAlert:
    "Vault is globally paused. Public mint and redeem are blocked until an operator clears pause.",
} as const;
