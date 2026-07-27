import { BRANDING } from "@/branding";

export type AssetStatus =
  | "active"
  | "paused"
  | "mint_only"
  | "redeem_only"
  | "deprecated";

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
  assetStatus: AssetStatus;
  klendEnabled: boolean;
};

export type VaultSummary = {
  admin: string;
  paused: boolean;
  programId: string;
  vaultConfig: string;
  wrappedMint: string;
  wrappedDecimals: number;
  mintMetadata?: MintMetadata | null;
  assets: VaultAsset[];
};

export type VaultMeta = {
  admin: string;
  paused: boolean;
  programId: string;
  vaultConfig: string;
  wrappedMint: string;
  wrappedDecimals: number;
  mintMetadata?: MintMetadata | null;
};

/** Response from GET /v1/vault/token-holders (token-account → amount atoms). */
export type TokenHolders = {
  wrappedMint: string;
  decimals: number;
  holders: Record<string, string>;
};

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
