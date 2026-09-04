import { ADMIN_COLLATERAL_MINTS } from "@/lib/mints";
import type { VaultAsset, VaultSummary } from "@/types/vault";
import type { LoadStatus } from "./types";

/** On-chain vault asset slot cap (`MAX_REGISTERED_ASSETS`). */
export const MAX_REGISTERED_ASSETS = 8;

export function selectVaultLoading(status: LoadStatus): boolean {
  return status === "idle" || status === "loading";
}

/**
 * Mints shown as Reserves rows.
 * Catalog (CCC/TTT) is localnet-only; elsewhere rows are on-chain assets only.
 */
export function selectRowMints(
  summary: VaultSummary | null,
  opts?: { includeCatalog?: boolean },
): string[] {
  const seen = new Set<string>();
  const mints: string[] = [];
  if (opts?.includeCatalog) {
    for (const m of ADMIN_COLLATERAL_MINTS) {
      if (!seen.has(m)) {
        seen.add(m);
        mints.push(m);
      }
    }
  }
  for (const a of summary?.assets ?? []) {
    if (!seen.has(a.mint)) {
      seen.add(a.mint);
      mints.push(a.mint);
    }
  }
  return mints;
}

export function selectAssetByMint(summary: VaultSummary | null): Map<string, VaultAsset> {
  const map = new Map<string, VaultAsset>();
  for (const a of summary?.assets ?? []) {
    map.set(a.mint, a);
  }
  return map;
}

export function selectVaultAsset(
  summary: VaultSummary | null,
  mint: string,
): VaultAsset | undefined {
  return summary?.assets.find((a) => a.mint === mint);
}
