import { BRANDING } from "@/branding";

export type MintMetadata = {
  name: string;
  symbol: string;
  decimals: number;
  uri: string;
  updateAuthority: string | null;
  isMutable: boolean;
};

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
  lendingMarket?: string | null;
  klendReserve?: string | null;
};

export type VaultSummary = {
  admin: string;
  paused: boolean;
  wrapPublic: boolean;
  unwrapPublic: boolean;
  pendingAdmin: string | null;
  pendingMintAuthority: string | null;
  mintAuthorityTransferred: boolean;
  allowlist: string[] | null;
  programId: string;
  vaultConfig: string;
  wrappedMint: string;
  wrappedDecimals: number;
  mintMetadata?: MintMetadata | null;
  circulatingSupply?: string;
  assets: VaultAsset[];
};

export type VaultMeta = {
  admin: string;
  paused: boolean;
  wrapPublic: boolean;
  unwrapPublic: boolean;
  pendingAdmin: string | null;
  pendingMintAuthority: string | null;
  mintAuthorityTransferred: boolean;
  allowlist: string[] | null;
  programId: string;
  vaultConfig: string;
  wrappedMint: string;
  wrappedDecimals: number;
  mintMetadata?: MintMetadata | null;
  circulatingSupply?: string;
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
  accessAllowed: boolean | null;
};

export type IssueQuote = {
  input: number;
  output: number;
  haircutBps: number;
  assetMint: string;
  mintEnabled: boolean;
  mintAllowed: boolean;
  canMint: boolean;
  mintCap: number;
  mintCapRemaining: number | null;
  accessAllowed: boolean | null;
};

export function wrappedTokenSymbol(
  summary: { mintMetadata?: MintMetadata | null } | null | undefined,
): string {
  return summary?.mintMetadata?.symbol ?? BRANDING.symbol;
}

export function wrappedTokenName(
  summary: { mintMetadata?: MintMetadata | null } | null | undefined,
): string {
  return summary?.mintMetadata?.name ?? BRANDING.name;
}
