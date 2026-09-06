/** User-facing vocabulary — admin console. Treasury = treasury_vault only. */
export const adminCopy = {
  officeTitle: "Swap Window",
  treasury: "Swap Window",
  reserves: "Reserves",
  tokenStats: "Token Stats",
  treasuryPageTitle: "Swap Window",
  treasuryPageDescription: (wrappedName: string, wrappedSymbol: string) =>
    `Issue ${wrappedName} from reserve collateral held by the admin, or redeem ${wrappedSymbol} for underlying. The backend signs and submits transactions. Enter human amounts (e.g. 1.0), not base units.`,
  treasurySigner: "Admin",
  treasuryOperations: "Swap Window",
  reserveGovernance: "Reserve governance",
  tokenStatsSubtitle: "Token address & holders",
  tokenStatsPageTitle: "Token Stats",
  tokenStatsPageDescription: (wrappedName: string, wrappedSymbol: string) =>
    `${wrappedName} (${wrappedSymbol}) mint metadata and largest token-account holders from the API.`,
  tokenContract: "Token Contract",
  decimals: "Decimals",
  circulatingSupply: "Total circulating supply",
  kaminoMarket: "Kamino market",
  kaminoMarketLive: "Live",
  holdersBreakdown: "Token Holders Breakdown",
  holdersCaption:
    "Top five token accounts by balance; remaining supply rolled into Others. Addresses are SPL token accounts.",
  holdersOthers: "Others",
  holdersEmpty: "No holder balances reported yet.",
  refreshHolders: "Refresh holders",
  accounts: "Accounts",
  accountsCaption:
    "Per-pool reserves, liability, and redeemable capacity.",
  issueViaTreasury: "Issue",
  redeemViaTreasury: "Redeem",
  submitting: "Submitting…",
  refreshLedger: "Refresh ledger",
  reserveGovernanceSubtitle: "Reserve governance",
  collateralPolicy: "Reserve governance",
  tabMint: "Mint Florin",
  tabRedeem: "Redeem Florin",
  reserveCollateral: "Reserve collateral",
  collateralAmount: "Collateral amount",
  redeemAmount: (symbol: string) => `${symbol} amount to redeem`,
  max: "Max",
  humanAmountHint: "Enter a human amount (e.g. 1.0), not base units.",
  redeemableBalance: (amount: string, symbol: string) => `Redeemable: ${amount} ${symbol}`,
  redeemDisabledAlert: "Redemption is disabled for this asset pool.",
  redeemLiabilityAlert: (liability: string, symbol: string) =>
    `Amount exceeds pool liability (${liability} ${symbol}). Reduce the burn amount or use another pool.`,
  redeemLiquidityAlertLead: (liquidity: string, symbol: string) =>
    `Free vault liquidity (${liquidity} ${symbol}) is below expected output.`,
  redeemLiquidityAlertRecall: "Recall",
  redeemLiquidityAlertTail: "from Kamino on Yield first.",
  redeemWouldFailAlert: "Redemption would fail on-chain for this amount.",
  signerHoldings: "Admin holdings",
  signerHoldingsCaption:
    "Tokens in the admin wallet. Mint spends collateral from here; redeem burns Florin from here.",
  signerHoldingsToken: "Token",
  signerHoldingsColumn: "Wallet",
  signerWalletBalance: (amount: string, symbol: string) => `Admin wallet: ${amount} ${symbol}`,
  loadingSignerBalance: "Loading admin wallet balance…",
  signerBalanceUnavailable: "Couldn't load admin wallet balance (RPC busy). Try Refresh ledger.",
  pausedVaultAlert:
    "Vault is paused. Mint, redeem, Kamino deposit, and harvest are blocked. Recall, sweep, and treasury withdrawal still work.",
  klendNav: "Yield",
  klendSubtitle: "Yield",
  klendPageTitle: "Yield",
  klendPageDescription:
    "Deploy idle collateral to Kamino, recall it for redemptions, then take protocol surplus into the treasury. Enter human amounts.",
  klendHarvestSweepBlurb: [
    "Harvest and sweep send the same extra to the treasury. They differ only in where that extra is sitting.",
    "You deposited 100 for holders, so you owe them 100. Park that 100 in Kamino. Later Kamino says the receipts are worth 103.",
    "If the extra 3 is still in Kamino, press Harvest: leave the 100 working and redeem only the yield into the treasury. If you already recalled, the home vault holds 103 against a 100 liability — press Sweep surplus to move the leftover 3. Holders cannot redeem it; redemptions stop at 100.",
    "Recall brings principal and yield home together, so both buttons exist. Harvest is optional if you want the yield without recalling. Neither touches user principal. Withdraw treasury is the later step that pays the operator.",
  ],
  klendNoAssets: "No registered collateral assets.",
  klendNotEnabled: "Kamino is not enabled for this asset. Vault-only ops (sweep, treasury withdraw) still apply.",
  klendDeploy: "Deploy",
  klendRecall: "Recall",
  klendRecallAll: "Recall all",
  klendHarvest: "Harvest",
  klendHarvestHint: "Capped by harvestable kTokens (surplus at exchange rate). On-chain harvest_yield enforces the same cap.",
  klendHarvestable: "Harvestable",
  klendSweep: "Sweep surplus",
  klendWithdrawTreasury: "Withdraw treasury",
  klendDeployAmount: "Deploy amount",
  klendRecallAmount: "Recall amount (kTokens)",
  klendHarvestAmount: "Harvest amount (kTokens)",
  klendSweepAmount: "Sweep amount",
  klendTreasuryAmount: "Treasury amount",
  klendDestination: "Destination wallet",
  klendAvailableDeploy: "Deployable",
  klendAvailableRecall: "Recallable",
  klendAvailableHarvest: "Harvestable",
  klendAvailableSweep: "Home surplus",
  klendAvailableTreasury: "Treasury",
  klendPrincipalInKamino: "Principal in Kamino",
  klendKtokensHeld: "kTokens held",
  klendKaminoAvailable: "Kamino available",
  klendKtokenUnit: "kTokens",
  vaultControls: "Controls",
  vaultNav: "Controls",
  vaultControlsSubtitle:
    "Pause, public wrap/unwrap, allowlist, admin transfer, and mint-authority handoff. Server-signed except accept, which uses a destination keypair file in this browser.",
  wrapPermanentlyDisabled:
    "Mint authority has been transferred. Wrap is permanently disabled on this vault; unwrap still follows per-pool policy.",
  pauseLabel: "Paused",
  wrapPublicLabel: "Wrap public",
  unwrapPublicLabel: "Unwrap public",
  vaultConfig: "Vault config",
  programId: "Program",
  allowlistTitle: "Allowlist",
  allowlistMissing: "Allowlist PDA is not initialized. Required when wrap or unwrap is not public.",
  initAllowlist: "Initialize allowlist",
  addAllowlistMember: "Add members",
  allowlistPubkey: "Wallet pubkeys (one per line)",
  allowlistEmpty: "No members.",
  allowlistCapHint: "On-chain max is 64 wallets. This is a protocol limit, not a UI limit.",
  allowlistCount: (n: number, max: number) => `${n} / ${max}`,
  privateFlagConfirm:
    "Allowlist is empty or missing. Only the admin wallet will be able to wrap or unwrap. Continue?",
  adminTransferTitle: "Admin transfer",
  newAdminPubkey: "New admin pubkey",
  proposeAdmin: "Propose",
  cancelAdminTransfer: "Cancel proposal",
  pendingAdmin: "Pending admin",
  acceptAdmin: "Accept as pending admin",
  keypairFile: "Destination keypair JSON",
  mintAuthorityTitle: "Mint authority",
  newMintAuthorityPubkey: "New mint authority pubkey",
  proposeMintAuthority: "Propose",
  cancelMintAuthority: "Cancel proposal",
  pendingMintAuthority: "Pending mint authority",
  acceptMintAuthority: "Accept mint authority",
  disableWrapConfirmLabel: 'Type DISABLE WRAP to confirm',
  disableWrapPhrase: "DISABLE WRAP",
  mintAuthorityAcceptWarning:
    "Accepting mint authority permanently disables wrap on this vault and moves SPL mint authority to the destination. Unwrap remains available for existing liability.",
  addCollateral: "Add collateral",
  addCollateralHint:
    "Paste an existing token mint. The console looks up whether a Kamino reserve already exists on this cluster — Register does not create one.",
  assetMintPubkey: "Token mint pubkey",
  registerMint: "Register",
  mintEnabledLabel: "Mint",
  redeemEnabledLabel: "Redeem",
  klendLookupChecking: "Checking Kamino for this mint…",
  klendLookupFound: "Kamino reserve found on this cluster. Enable Kamino after register to point at it.",
  klendLookupFoundMany: (n: number) =>
    `${n} Kamino reserves found for this mint. Pick which market to point at after register.`,
  klendLookupNone:
    "No Kamino reserve for this mint on this cluster. You can still register it as vault-only collateral.",
  klendLookupMintMissing: "This mint does not exist on this cluster.",
  klendLookupError: "Could not query Kamino reserves",
  enableKlend: "Enable Kamino",
  enableKlendHint:
    "Point this asset at an existing Kamino reserve (one-shot). Fields fill automatically when a reserve is found — do not create a new market here.",
  lendingMarket: "Lending market",
  klendReserve: "Reserve",
  reserveLiquiditySupply: "Reserve liquidity supply",
  collateralMint: "Collateral mint (kToken)",
} as const;

/** Shared accounting-term labels + hover hints. One explanation per concept. */
export type MetricHint = {
  label: string;
  hint: string;
};

export const metricHints = {
  asset: {
    label: "Asset",
    hint: "Collateral mint for this pool. Each asset has its own vault, liability, and optional Kamino wiring.",
  },
  kaminoMarket: {
    label: "Kamino market",
    hint: "Lending market this pool is pointed at. Live means Kamino is enabled; a dash means vault-only.",
  },
  homeVault: {
    label: "Home vault",
    hint: "Free liquidity in the home token vault. Redemptions pay from here. Excludes tokens deployed to Kamino and treasury.",
  },
  cushion: {
    label: "Cushion",
    hint: "Operator reserve (min_liquidity_target) kept in the home vault and not deployed to Kamino.",
  },
  inKamino: {
    label: "In Kamino",
    hint: "Principal currently deployed to Kamino. Does not include unharvested yield.",
  },
  backing: {
    label: "Backing",
    hint: "Home vault plus In Kamino. Collateral covering this pool's liability. Treasury is not backing.",
  },
  treasury: {
    label: "Treasury",
    hint: "Protocol yield in the treasury vault. Not user backing. Withdrawable; never redeployed to Kamino.",
  },
  kaminoSurplus: {
    label: "Kamino surplus",
    hint: "Unharvested Kamino yield above deployed principal. Harvest moves it to the treasury.",
  },
  liabilityUnderlying: {
    label: "Liability (underlying)",
    hint: "The same obligation in this asset's decimals. Used in the home-surplus formula.",
  },
  homeSurplus: {
    label: "Home surplus",
    hint: "Home vault minus liability (underlying) minus cushion, floored at zero. Sweepable by admin; not user-redeemable.",
  },
  maxRedeemable: {
    label: "Max redeemable",
    hint: "The lesser of this pool's liability and home-vault liquidity, in wrapped tokens.",
  },
} as const satisfies Record<string, MetricHint>;

export type MetricHintKey = keyof typeof metricHints;

/** Liability in wrapped-token units; label includes the mint symbol. */
export function liabilityWrappedMetric(wrappedSymbol: string): MetricHint {
  return {
    label: `Liability (${wrappedSymbol})`,
    hint: `Outstanding wrapped tokens (${wrappedSymbol}) still redeemable through this pool (minted − redeemed).`,
  };
}
