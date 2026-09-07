"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api";
import { requirePubkey } from "@/lib/pubkey";
import type { EnableKlendDraft } from "./governanceStore";

export type KlendReserveMatch = {
  lendingMarket: string;
  reserve: string;
  reserveLiquiditySupply: string;
  collateralMint: string;
};

export type KlendReserveLookup = {
  assetMint: string;
  mintExists: boolean;
  reserves: KlendReserveMatch[];
};

export type KlendLookupEntry =
  | { status: "loading" }
  | { status: "ready"; data: KlendReserveLookup }
  | { status: "error"; error: string };

type KlendLookupState = {
  lookups: Record<string, KlendLookupEntry>;
  ensureLookup: (mint: string) => void;
  reset: () => void;
};

const inflight = new Set<string>();

export function matchToEnableDraft(match: KlendReserveMatch): EnableKlendDraft {
  return {
    lendingMarket: match.lendingMarket,
    reserve: match.reserve,
    reserveLiquiditySupply: match.reserveLiquiditySupply,
    collateralMint: match.collateralMint,
  };
}

export const useKlendLookupStore = create<KlendLookupState>()((set, get) => ({
  lookups: {},

  reset: () => set({ lookups: {} }),

  ensureLookup: (raw) => {
    const parsed = requirePubkey(raw, "asset mint");
    if (!parsed.ok) return;
    const mint = parsed.data;
    const existing = get().lookups[mint];
    if (existing?.status === "loading" || existing?.status === "ready") return;
    if (inflight.has(mint)) return;
    inflight.add(mint);
    set((state) => ({
      lookups: { ...state.lookups, [mint]: { status: "loading" } },
    }));
    void apiGet<KlendReserveLookup>(
      `/v1/admin/klend-reserve?assetMint=${encodeURIComponent(mint)}`,
    )
      .then((data) => {
        set((state) => ({
          lookups: { ...state.lookups, [mint]: { status: "ready", data } },
        }));
      })
      .catch((e) => {
        set((state) => ({
          lookups: {
            ...state.lookups,
            [mint]: { status: "error", error: (e as Error).message },
          },
        }));
      })
      .finally(() => {
        inflight.delete(mint);
      });
  },
}));
