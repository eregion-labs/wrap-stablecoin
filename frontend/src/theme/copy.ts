/** User-facing vocabulary — public merchant app. */
export const publicCopy = {
  pageTitle: "Mint & redeem",
  pageDescription:
    "Issue Florin against registered reserve collateral or redeem Florin for underlying. Amounts are in smallest on-chain units.",
  tabMint: "Mint Florin",
  tabRedeem: "Redeem Florin",
  holdings: "Holdings",
  holdingsColumn: "Holdings",
  connectAccount: "Connect account",
  merchantAccount: "Merchant account",
  connectedAccount: "Connected account",
  changeAccount: "Change account",
  copyAddress: "Copy address",
  disconnect: "Disconnect",
  reserveCollateral: "Reserve collateral",
  refreshLedger: "Refresh ledger",
  collateralAmount: "Collateral amount (base units)",
  redeemAmount: (symbol: string) => `${symbol} amount to redeem`,
  signAndSend: "Sign & send",
  simulate: "Simulate",
  signing: "Signing…",
  headerTagline: "Mint & redeem",
} as const;
