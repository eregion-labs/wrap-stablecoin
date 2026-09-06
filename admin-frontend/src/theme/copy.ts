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
    "Per-pool controls (issue/redeem, status, haircuts, caps, cushion), reserves, liability, and redeemable capacity.",
  issueViaTreasury: "Issue",
  redeemViaTreasury: "Redeem",
  submitting: "Submitting…",
  refreshLedger: "Refresh ledger",
  reserveGovernanceSubtitle: "Reserve governance",
  collateralPolicy: "Reserve governance",
  composeTitle: "Issue / Redeem",
  composeCaption:
    "Compose an issue or redeem. Figures below are a pending preview — nothing is on-chain until you submit.",
  tabMint: "Issue Florin",
  tabRedeem: "Redeem Florin",
  tabAriaLabel: "Issue or redeem Florin",
  issuedSnackbar: (symbol: string, sigPrefix: string) =>
    `Issued ${symbol} — ${sigPrefix}…`,
  redeemedSnackbar: (sigPrefix: string) => `Redeemed underlying — ${sigPrefix}…`,
  expectedIssueOutput: "Expected output",
  expectedRedeemOutput: "Expected output",
  swapPreviewTitle: "Pending change",
  swapPreviewAdminCollateral: (symbol: string) => `Admin ${symbol}`,
  swapPreviewAdminWrapped: (symbol: string) => `Admin ${symbol}`,
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
  mintEnabledLabel: "Issue",
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
    hint: "This pool's min liquidity: underlying kept in the home vault, not deployed to Kamino, and not sweepable as home surplus. Users can still redeem through it. 0 = no reserve.",
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
  mintEnabled: {
    label: "Issue",
    hint: "When on (and Status allows), users may issue wrapped tokens against this collateral. Off blocks new issues for this pool.",
  },
  redeemEnabled: {
    label: "Redeem",
    hint: "When on (and Status allows), users may burn wrapped tokens for this collateral. Off blocks unwraps for this pool.",
  },
  assetStatus: {
    label: "Status",
    hint: "Pool mode layered on the Issue/Redeem switches: active (both), mint_only (issue only), redeem_only, paused, or deprecated. Issue/redeem only run when both the matching switch and this status allow it.",
  },
  mintHaircutBps: {
    label: "Issue haircut (bps)",
    hint: "Basis points withheld on issue. 0 = 1:1; 200 = issue 0.98 wrapped per 1.0 collateral (2%). Percent = bps / 100.",
  },
  redeemHaircutBps: {
    label: "Redeem haircut (bps)",
    hint: "Basis points withheld on unwrap. 0 = 1:1; 2000 = pay 0.80 collateral per 1.0 wrapped burned (20%). Percent = bps / 100.",
  },
  mintCap: {
    label: "Issue cap",
    hint: "Max outstanding Florin from this pool (issued − redeemed). This is the protocol's exposure to this reserve. 0 = unlimited. New issues that would exceed it fail.",
  },
  exposureCap: {
    label: "Exposure cap",
    hint: "Second, optional ceiling on the same outstanding liability as issue cap. Same wrap check; the tighter of the two wins. 0 = unused.",
  },
  policyActions: {
    label: "Actions",
    hint: "Register creates the on-chain pool for an unregistered mint. Save policy writes Issue/Redeem, Status, haircuts, caps, and Cushion for a registered pool.",
  },
} as const satisfies Record<string, MetricHint>;

export type MetricHintKey = keyof typeof metricHints;

/** Outstanding minted against a reserve (pool liability); label includes the mint symbol. */
export function liabilityWrappedMetric(wrappedSymbol: string): MetricHint {
  return {
    label: `Liability (${wrappedSymbol})`,
    hint: `Outstanding ${wrappedSymbol} issued against this reserve (issued − redeemed). Same as Minted. maxRedeemable = min(this, home vault); anything above maxRedeemable needs a Kamino recall before redeem — that remainder is not the same as In Kamino (which can include surplus).`,
  };
}

/** Left-column Accounts label for the same liability figure. */
export function mintedByReserveMetric(wrappedSymbol: string): MetricHint {
  return {
    label: `Minted (${wrappedSymbol})`,
    hint: liabilityWrappedMetric(wrappedSymbol).hint,
  };
}
