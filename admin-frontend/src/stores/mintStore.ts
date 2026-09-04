"use client";

import { create } from "zustand";
import { apiGet, apiPost } from "@/lib/api";
import { parseTokenAmount } from "@/lib/tokenAmount";
import type { RedeemQuote, VaultSummary } from "@/types/vault";
import { actionErr, actionOk, type ActionResult } from "./types";
import { useVaultStore } from "./vaultStore";

function collateralDecimals(assetMint: string): number {
  const asset = useVaultStore.getState().summary?.assets.find((a) => a.mint === assetMint);
  return asset?.tokenDecimals ?? 6;
}

function wrappedDecimals(): number {
  return useVaultStore.getState().summary?.wrappedDecimals ?? 6;
}

const QUOTE_DEBOUNCE_MS = 300;

type QuoteStatus = "idle" | "loading" | "ready";

type MintState = {
  assetMint: string;
  mintAmount: string;
  redeemAmount: string;
  redeemQuote: RedeemQuote | null;
  quoteStatus: QuoteStatus;
  busy: "mint" | "redeem" | null;

  _quoteTimer: ReturnType<typeof setTimeout> | null;
  _quoteGeneration: number;

  reset: () => void;
  syncFromSummary: (summary: VaultSummary | null) => void;
  setAssetMint: (mint: string) => void;
  setMintAmount: (amount: string) => void;
  setRedeemAmount: (amount: string) => void;
  scheduleRedeemQuote: () => void;
  fetchRedeemQuote: () => Promise<void>;
  submitMint: () => Promise<ActionResult<{ signature: string }>>;
  submitRedeem: () => Promise<ActionResult<{ signature: string }>>;
};

const initialMintState = {
  assetMint: "",
  mintAmount: "1",
  redeemAmount: "1",
  redeemQuote: null as RedeemQuote | null,
  quoteStatus: "idle" as QuoteStatus,
  busy: null as "mint" | "redeem" | null,
  _quoteTimer: null as ReturnType<typeof setTimeout> | null,
  _quoteGeneration: 0,
};

function clearQuoteTimer(state: MintState) {
  if (state._quoteTimer) clearTimeout(state._quoteTimer);
}

export const useMintStore = create<MintState>()((set, get) => ({
  ...initialMintState,

  reset: () => {
    const { _quoteTimer } = get();
    if (_quoteTimer) clearTimeout(_quoteTimer);
    set({ ...initialMintState });
  },

  syncFromSummary: (summary) => {
    const assets = summary?.assets ?? [];
    const { assetMint } = get();
    if (assets.length === 0) {
      set({ assetMint: "", redeemQuote: null, quoteStatus: "idle" });
      return;
    }
    const valid = assets.some((a) => a.mint === assetMint);
    if (!valid) {
      set({ assetMint: assets[0].mint });
    }
    get().scheduleRedeemQuote();
  },

  setAssetMint: (mint) => {
    set({ assetMint: mint });
    get().scheduleRedeemQuote();
  },

  setMintAmount: (amount) => set({ mintAmount: amount }),

  setRedeemAmount: (amount) => {
    set({ redeemAmount: amount });
    get().scheduleRedeemQuote();
  },

  scheduleRedeemQuote: () => {
    const state = get();
    clearQuoteTimer(state);
    const timer = setTimeout(() => {
      set({ _quoteTimer: null });
      void get().fetchRedeemQuote();
    }, QUOTE_DEBOUNCE_MS);
    set({ _quoteTimer: timer });
  },

  fetchRedeemQuote: async () => {
    const generation = get()._quoteGeneration + 1;
    set({ _quoteGeneration: generation });

    const { assetMint, redeemAmount } = get();
    const amount = parseTokenAmount(redeemAmount, wrappedDecimals());
    if (!assetMint || amount == null) {
      set({ redeemQuote: null, quoteStatus: "idle" });
      return;
    }

    set({ quoteStatus: "loading" });
    try {
      const params = new URLSearchParams({
        amount: String(amount),
        assetMint,
      });
      const quote = await apiGet<RedeemQuote>(`/v1/quote/redeem?${params.toString()}`);
      if (get()._quoteGeneration !== generation) return;
      set({ redeemQuote: quote, quoteStatus: "ready" });
    } catch {
      if (get()._quoteGeneration !== generation) return;
      set({ redeemQuote: null, quoteStatus: "idle" });
    }
  },

  submitMint: async () => {
    const { assetMint, mintAmount } = get();
    const amount = parseTokenAmount(mintAmount, collateralDecimals(assetMint));
    if (!assetMint || amount == null) {
      return actionErr("invalid amount");
    }

    set({ busy: "mint" });
    try {
      const { signature } = await apiPost<{ amount: number; assetMint: string }, { signature: string }>(
        "/v1/admin/mint",
        { amount, assetMint },
      );
      await useVaultStore.getState().refresh();
      return actionOk({ signature });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },

  submitRedeem: async () => {
    const { assetMint, redeemAmount, redeemQuote } = get();
    const amount = parseTokenAmount(redeemAmount, wrappedDecimals());
    if (!assetMint || amount == null) {
      return actionErr("invalid amount");
    }
    if (!redeemQuote?.canRedeem) {
      return actionErr("redemption would fail on-chain for this amount");
    }

    set({ busy: "redeem" });
    try {
      const { signature } = await apiPost<{ amount: number; assetMint: string }, { signature: string }>(
        "/v1/admin/redeem",
        { amount, assetMint },
      );
      await useVaultStore.getState().refresh();
      get().scheduleRedeemQuote();
      return actionOk({ signature });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },
}));
