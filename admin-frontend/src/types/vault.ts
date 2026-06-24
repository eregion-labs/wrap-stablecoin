export type VaultAsset = {
  mint: string;
  tokenDecimals: number;
  freeLiquidity: number;
  deployedToKamino: number;
  treasuryBalance: number;
  backing: number;
  liability: number;
  liabilityUnderlying: number;
  cushion: number;
  kaminoSurplus: number;
  homeSurplus: number;
  maxRedeemable: number;
  mintEnabled: boolean;
  redeemEnabled: boolean;
  mintAllowed: boolean;
  redeemAllowed: boolean;
  mintHaircutBps: number;
  redemptionHaircutBps: number;
  mintCap: number;
  exposureCap: number;
  minLiquidityTarget: number;
  netLiability: number;
  assetStatus: string;
  klendEnabled: boolean;
};

export type VaultSummary = {
  admin: string;
  paused: boolean;
  programId: string;
  vaultConfig: string;
  wrappedMint: string;
  wrappedDecimals: number;
  assets: VaultAsset[];
};

export type VaultMeta = {
  admin: string;
  paused: boolean;
  programId: string;
  vaultConfig: string;
  wrappedMint: string;
  wrappedDecimals: number;
};

export type AssetStatus =
  | "active"
  | "paused"
  | "mint_only"
  | "redeem_only"
  | "deprecated";

export type RedeemQuote = {
  input: number;
  output: number;
  haircutBps: number;
  assetMint: string;
  freeLiquidity: number;
  liability: number;
  redeemAllowed: boolean;
  canRedeem: boolean;
  liquidityShortfall: number;
  liabilityShortfall: number;
  maxRedeemable: number;
};
