"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api";
import type { VaultMeta, VaultSummary } from "@/types/vault";
import type { LoadStatus } from "./types";

type VaultState = {
  meta: VaultMeta | null;
  summary: VaultSummary | null;
  status: LoadStatus;
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

    const run = (async () => {
      set({ status: "loading", error: null });
      try {
        const { meta, summary } = await fetchVault();
        set({
          meta,
          summary,
          status: "ready",
          error: null,
          inflight: null,
        });
      } catch (e) {
        set({
          meta: null,
          summary: null,
          status: "error",
          error: (e as Error).message,
          inflight: null,
        });
      }
    })();

    set({ inflight: run });
    return run;
  },

  refresh: () => get().hydrate(),
}));
