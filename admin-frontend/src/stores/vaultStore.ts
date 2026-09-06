"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api";
import type { VaultMeta, VaultSummary } from "@/types/vault";
import type { LoadStatus } from "./types";

type VaultState = {
  meta: VaultMeta | null;
  summary: VaultSummary | null;
  status: LoadStatus;
  /** True while a background refresh is in flight (UI stays mounted). */
  refreshing: boolean;
  error: string | null;
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
  refreshing: false,
  error: null,
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

    const hasData = get().summary != null || get().meta != null;
    const run = (async () => {
      if (hasData) {
        set({ refreshing: true, error: null });
      } else {
        set({ status: "loading", error: null });
      }
      try {
        const { meta, summary } = await fetchVault();
        set({
          meta,
          summary,
          status: "ready",
          refreshing: false,
          error: null,
          inflight: null,
        });
      } catch (e) {
        if (hasData) {
          // Keep stale ledger visible; surface the error.
          set({
            refreshing: false,
            error: (e as Error).message,
            inflight: null,
          });
        } else {
          set({
            meta: null,
            summary: null,
            status: "error",
            refreshing: false,
            error: (e as Error).message,
            inflight: null,
          });
        }
      }
    })();

    set({ inflight: run });
    return run;
  },

  refresh: () => get().hydrate(),
}));
