"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api";
import type { TokenHolders } from "@/types/vault";
import type { LoadStatus } from "./types";

type TokenHoldersState = {
  data: TokenHolders | null;
  status: LoadStatus;
  error: string | null;
  inflight: Promise<void> | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
};

const initialState = {
  data: null,
  status: "idle" as LoadStatus,
  error: null,
  inflight: null,
};

export const useTokenHoldersStore = create<TokenHoldersState>()((set, get) => ({
  ...initialState,

  reset: () => set({ ...initialState }),

  hydrate: async () => {
    const existing = get().inflight;
    if (existing) return existing;

    const run = (async () => {
      set({ status: "loading", error: null });
      try {
        const data = await apiGet<TokenHolders>("/v1/vault/token-holders");
        set({
          data,
          status: "ready",
          error: null,
          inflight: null,
        });
      } catch (e) {
        set({
          data: null,
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
