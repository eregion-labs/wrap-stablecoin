"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api";
import type { AppNetwork } from "@/stores/networkStore";
import { useNetworkStore } from "@/stores/networkStore";
import type { VaultMeta, VaultSummary } from "@/types/vault";
import type { LoadStatus } from "./types";

type VaultState = {
  meta: VaultMeta | null;
  summary: VaultSummary | null;
  status: LoadStatus;
  error: string | null;
  /** Cluster the cached payload belongs to — stale if it diverges from networkStore. */
  network: AppNetwork | null;
  /** Coalesces overlapping hydrate() calls. */
  inflight: Promise<void> | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
};

const initialVaultState = {
  meta: null,
  summary: null,
  status: "idle" as LoadStatus,
  error: null,
  network: null,
  inflight: null,
};

async function fetchVault(): Promise<{ meta: VaultMeta; summary: VaultSummary }> {
  const [meta, summary] = await Promise.all([
    apiGet<VaultMeta>("/v1/vault/meta"),
    apiGet<VaultSummary>("/v1/vault/assets"),
  ]);
  return { meta, summary };
}

export const useVaultStore = create<VaultState>()((set, get) => ({
  ...initialVaultState,

  reset: () => set({ ...initialVaultState }),

  hydrate: async () => {
    const existing = get().inflight;
    if (existing) return existing;

    const network = useNetworkStore.getState().network;
    const run = (async () => {
      set({ status: "loading", error: null, network });
      try {
        const { meta, summary } = await fetchVault();
        set({
          meta,
          summary,
          status: "ready",
          error: null,
          network,
          inflight: null,
        });
      } catch (e) {
        set({
          meta: null,
          summary: null,
          status: "error",
          error: (e as Error).message,
          network,
          inflight: null,
        });
      }
    })();

    set({ inflight: run });
    return run;
  },

  refresh: () => get().hydrate(),
}));
