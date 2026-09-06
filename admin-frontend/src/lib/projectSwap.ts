import type { VaultAsset } from "@/types/vault";

const BPS_DENOM = 10_000;
const MAX_TOKEN_DECIMALS = 18;

const POW10: number[] = (() => {
  const out = [1];
  for (let i = 1; i <= MAX_TOKEN_DECIMALS; i++) out.push(out[i - 1] * 10);
  return out;
})();

/** Truncates toward zero on down-scale — matches on-chain `convert_amount`. */
export function convertAmount(
  amount: number,
  fromDecimals: number,
  toDecimals: number,
): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (fromDecimals === toDecimals) return Math.floor(amount);
  if (fromDecimals < toDecimals) {
    const exp = toDecimals - fromDecimals;
    if (exp > MAX_TOKEN_DECIMALS) return 0;
    return Math.floor(amount * POW10[exp]);
  }
  const exp = fromDecimals - toDecimals;
  if (exp > MAX_TOKEN_DECIMALS) return 0;
  return Math.floor(amount / POW10[exp]);
}

export function homeSurplusAmount(
  tokenVaultBalance: number,
  liabilityWstable: number,
  underlyingDecimals: number,
  wrappedDecimals: number,
  cushion: number,
): number {
  const liabilityUnderlying = convertAmount(
    liabilityWstable,
    wrappedDecimals,
    underlyingDecimals,
  );
  return Math.max(0, tokenVaultBalance - liabilityUnderlying - cushion);
}

/** Max wrapped atoms redeemable given free liquidity (ceiling on haircut inverse). */
export function maxWrappedForLiquidity(
  freeLiquidity: number,
  underlyingDecimals: number,
  wrappedDecimals: number,
  redemptionHaircutBps: number,
): number {
  if (freeLiquidity <= 0) return 0;
  const preHaircut =
    redemptionHaircutBps === 0
      ? freeLiquidity
      : Number(
          (BigInt(Math.floor(freeLiquidity)) * BigInt(BPS_DENOM) +
            BigInt(BPS_DENOM - redemptionHaircutBps) -
            BigInt(1)) /
            BigInt(BPS_DENOM - redemptionHaircutBps),
        );
  return convertAmount(preHaircut, underlyingDecimals, wrappedDecimals);
}

export function maxRedeemableWstable(
  liability: number,
  freeLiquidity: number,
  underlyingDecimals: number,
  wrappedDecimals: number,
  redemptionHaircutBps: number,
): number {
  if (liability <= 0) return 0;
  const fromLiquidity = maxWrappedForLiquidity(
    freeLiquidity,
    underlyingDecimals,
    wrappedDecimals,
    redemptionHaircutBps,
  );
  return Math.min(liability, fromLiquidity);
}

export type SwapSide = "issue" | "redeem";

export type ProjectedFigures = {
  freeLiquidity: number;
  cushion: number;
  deployedToKamino: number;
  backing: number;
  treasuryBalance: number;
  kaminoSurplus: number;
  liability: number;
  liabilityUnderlying: number;
  homeSurplus: number;
  maxRedeemable: number;
  adminCollateral: number;
  adminWrapped: number;
};

export type ProjectSwapInput = {
  side: SwapSide;
  asset: VaultAsset;
  wrappedDecimals: number;
  /** Collateral atoms in (issue) or wrapped atoms in (redeem). */
  input: number;
  /** Wrapped atoms out (issue) or collateral atoms out (redeem). */
  output: number;
  adminCollateralAtoms: number;
  adminWrappedAtoms: number;
};

/**
 * Project post-tx Accounts + admin-wallet figures from a quote.
 * Haircut leftover stays in the home vault (not treasury).
 */
export function projectSwapFigures(input: ProjectSwapInput): ProjectedFigures {
  const { side, asset, wrappedDecimals, input: inAtoms, output: outAtoms } = input;
  const d = asset.tokenDecimals;

  const freeLiquidity =
    side === "issue"
      ? asset.freeLiquidity + inAtoms
      : Math.max(0, asset.freeLiquidity - outAtoms);
  const liability =
    side === "issue"
      ? asset.liability + outAtoms
      : Math.max(0, asset.liability - inAtoms);

  const liabilityUnderlying = convertAmount(liability, wrappedDecimals, d);
  const homeSurplus = homeSurplusAmount(
    freeLiquidity,
    liability,
    d,
    wrappedDecimals,
    asset.cushion,
  );
  const maxRedeemable = maxRedeemableWstable(
    liability,
    freeLiquidity,
    d,
    wrappedDecimals,
    asset.redemptionHaircutBps,
  );

  const adminCollateral =
    side === "issue"
      ? Math.max(0, input.adminCollateralAtoms - inAtoms)
      : input.adminCollateralAtoms + outAtoms;
  const adminWrapped =
    side === "issue"
      ? input.adminWrappedAtoms + outAtoms
      : Math.max(0, input.adminWrappedAtoms - inAtoms);

  return {
    freeLiquidity,
    cushion: asset.cushion,
    deployedToKamino: asset.deployedToKamino,
    backing: freeLiquidity + asset.deployedToKamino,
    treasuryBalance: asset.treasuryBalance,
    kaminoSurplus: asset.kaminoSurplus,
    liability,
    liabilityUnderlying,
    homeSurplus,
    maxRedeemable,
    adminCollateral,
    adminWrapped,
  };
}

export type CurrentFigures = {
  freeLiquidity: number;
  cushion: number;
  deployedToKamino: number;
  backing: number;
  treasuryBalance: number;
  kaminoSurplus: number;
  liability: number;
  liabilityUnderlying: number;
  homeSurplus: number;
  maxRedeemable: number;
  adminCollateral: number;
  adminWrapped: number;
};

export function currentFigures(
  asset: VaultAsset,
  adminCollateralAtoms: number,
  adminWrappedAtoms: number,
): CurrentFigures {
  return {
    freeLiquidity: asset.freeLiquidity,
    cushion: asset.cushion,
    deployedToKamino: asset.deployedToKamino,
    backing: asset.backing,
    treasuryBalance: asset.treasuryBalance,
    kaminoSurplus: asset.kaminoSurplus,
    liability: asset.liability,
    liabilityUnderlying: asset.liabilityUnderlying,
    homeSurplus: asset.homeSurplus,
    maxRedeemable: asset.maxRedeemable,
    adminCollateral: adminCollateralAtoms,
    adminWrapped: adminWrappedAtoms,
  };
}

// ponytail: assert-based self-check; fails loudly if projection math drifts from on-chain formulas.
function assertProjectSwapSelfCheck() {
  // convert_amount: 1e6 underlying → 1e9 wrapped (6→9)
  if (convertAmount(1_000_000, 6, 9) !== 1_000_000_000) {
    throw new Error("projectSwap: convertAmount upscale failed");
  }
  // convert_amount: 1e9 wrapped → 1e6 underlying (9→6)
  if (convertAmount(1_000_000_000, 9, 6) !== 1_000_000) {
    throw new Error("projectSwap: convertAmount downscale failed");
  }
  // home surplus: vault 103, liability 100 (same decimals), cushion 0 → 3
  if (homeSurplusAmount(103, 100, 6, 6, 0) !== 3) {
    throw new Error("projectSwap: homeSurplusAmount failed");
  }
  // max redeemable: liability 50, liquidity 40, no haircut, same decimals → 40
  if (maxRedeemableWstable(50, 40, 6, 6, 0) !== 40) {
    throw new Error("projectSwap: maxRedeemableWstable failed");
  }
  // issue: +10 home, +10 liability (1:1), admin collateral −10, admin wrapped +10
  const asset: VaultAsset = {
    mint: "test",
    tokenDecimals: 6,
    freeLiquidity: 100,
    deployedToKamino: 0,
    treasuryBalance: 0,
    backing: 100,
    liability: 50,
    liabilityUnderlying: 50,
    cushion: 0,
    kaminoSurplus: 0,
    homeSurplus: 50,
    maxRedeemable: 50,
    mintEnabled: true,
    redeemEnabled: true,
    mintAllowed: true,
    redeemAllowed: true,
    mintHaircutBps: 0,
    redemptionHaircutBps: 0,
    mintCap: 0,
    exposureCap: 0,
    minLiquidityTarget: 0,
    netLiability: 50,
    assetStatus: "active",
    klendEnabled: false,
  };
  const projected = projectSwapFigures({
    side: "issue",
    asset,
    wrappedDecimals: 6,
    input: 10,
    output: 10,
    adminCollateralAtoms: 1000,
    adminWrappedAtoms: 100,
  });
  if (
    projected.freeLiquidity !== 110 ||
    projected.liability !== 60 ||
    projected.backing !== 110 ||
    projected.adminCollateral !== 990 ||
    projected.adminWrapped !== 110 ||
    projected.cushion !== 0
  ) {
    throw new Error("projectSwap: issue projection failed");
  }
  const redeemed = projectSwapFigures({
    side: "redeem",
    asset,
    wrappedDecimals: 6,
    input: 10,
    output: 10,
    adminCollateralAtoms: 1000,
    adminWrappedAtoms: 100,
  });
  if (
    redeemed.freeLiquidity !== 90 ||
    redeemed.liability !== 40 ||
    redeemed.adminCollateral !== 1010 ||
    redeemed.adminWrapped !== 90
  ) {
    throw new Error("projectSwap: redeem projection failed");
  }
}

assertProjectSwapSelfCheck();
