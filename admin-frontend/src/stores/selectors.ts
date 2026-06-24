import { ADMIN_COLLATERAL_MINTS } from "@/lib/mints";
import type { VaultAsset, VaultSummary } from "@/types/vault";
import type { LoadStatus } from "./types";

export function selectVaultLoading(status: LoadStatus): boolean {
  return status === "idle" || status === "loading";
}

export function selectRowMints(summary: VaultSummary | null): string[] {
  const seen = new Set<string>();
  const mints: string[] = [];
  for (const m of ADMIN_COLLATERAL_MINTS) {
    if (!seen.has(m)) {
      seen.add(m);
      mints.push(m);
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
