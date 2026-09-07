"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { create } from "zustand";
import { fetchWalletBalances } from "@/lib/walletBalances";
import { getApplicationServices } from "@/providers/ClientConfigProvider";
import type { VaultSummary } from "@/types/vault";
import type { LoadStatus } from "./types";
import { useVaultStore } from "./vaultStore";

type SignerBalancesState = {
  owner: string | null;
  balances: Record<string, number>;
  status: LoadStatus;
  error: string | null;
  _generation: number;

  hydrate: (summary: VaultSummary | null) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
};

const initialState = {
  owner: null as string | null,
  balances: {} as Record<string, number>,
  status: "idle" as LoadStatus,
  error: null as string | null,
  _generation: 0,
};

let cachedRpc: string | null = null;
let cachedConnection: Connection | null = null;

function rpcConnection(): Connection {
  const rpcUrl = getApplicationServices().config.solana.rpcUrl;
  if (!cachedConnection || cachedRpc !== rpcUrl) {
    cachedRpc = rpcUrl;
    cachedConnection = new Connection(rpcUrl, "confirmed");
  }
  return cachedConnection;
}

function mintKeys(summary: VaultSummary): PublicKey[] {
  return [...summary.assets.map((a) => new PublicKey(a.mint)), new PublicKey(summary.wrappedMint)];
}

export const useSignerBalancesStore = create<SignerBalancesState>()((set, get) => ({
  ...initialState,

  reset: () => set({ ...initialState }),

  hydrate: async (summary) => {
    if (!summary?.admin) {
      set({ ...initialState });
      return;
    }

    const generation = get()._generation + 1;
    set({ status: "loading", error: null, owner: summary.admin, _generation: generation });
    try {
      const map = await fetchWalletBalances(
        rpcConnection(),
        new PublicKey(summary.admin),
        mintKeys(summary),
      );
      if (get()._generation !== generation) return;
      const balances: Record<string, number> = {};
      for (const [mint, amount] of map) balances[mint] = amount;
      set({
        balances,
        status: "ready",
        error: null,
      });
    } catch (e) {
      if (get()._generation !== generation) return;
      set({
        status: "error",
        error: (e as Error).message,
      });
    }
  },

  refresh: () => get().hydrate(useVaultStore.getState().summary),
}));
