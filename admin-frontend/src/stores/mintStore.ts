"use client";

import { create } from "zustand";
import { apiGet, apiPost } from "@/lib/api";
import { parseTokenAmount } from "@/lib/tokenAmount";
import type { IssueQuote, RedeemQuote, VaultSummary } from "@/types/vault";
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
  issueQuote: IssueQuote | null;
  redeemQuote: RedeemQuote | null;
  issueQuoteStatus: QuoteStatus;
  quoteStatus: QuoteStatus;
  busy: "mint" | "redeem" | null;

  _issueQuoteTimer: ReturnType<typeof setTimeout> | null;
  _quoteTimer: ReturnType<typeof setTimeout> | null;
  _issueQuoteGeneration: number;
  _quoteGeneration: number;

  reset: () => void;
  syncFromSummary: (summary: VaultSummary | null) => void;
  setAssetMint: (mint: string) => void;
  setMintAmount: (amount: string) => void;
  setRedeemAmount: (amount: string) => void;
  scheduleIssueQuote: () => void;
  scheduleRedeemQuote: () => void;
  fetchIssueQuote: () => Promise<void>;
  fetchRedeemQuote: () => Promise<void>;
  submitMint: () => Promise<ActionResult<{ signature: string }>>;
  submitRedeem: () => Promise<ActionResult<{ signature: string }>>;
};

const initialMintState = {
  assetMint: "",
  mintAmount: "1",
  redeemAmount: "1",
  issueQuote: null as IssueQuote | null,
  redeemQuote: null as RedeemQuote | null,
  issueQuoteStatus: "idle" as QuoteStatus,
  quoteStatus: "idle" as QuoteStatus,
  busy: null as "mint" | "redeem" | null,
  _issueQuoteTimer: null as ReturnType<typeof setTimeout> | null,
  _quoteTimer: null as ReturnType<typeof setTimeout> | null,
  _issueQuoteGeneration: 0,
  _quoteGeneration: 0,
};

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer) clearTimeout(timer);
}

export const useMintStore = create<MintState>()((set, get) => ({
  ...initialMintState,

  reset: () => {
    const { _issueQuoteTimer, _quoteTimer } = get();
    clearTimer(_issueQuoteTimer);
    clearTimer(_quoteTimer);
    set({ ...initialMintState });
  },

  syncFromSummary: (summary) => {
    const assets = summary?.assets ?? [];
    const { assetMint } = get();
    if (assets.length === 0) {
      set({
        assetMint: "",
        issueQuote: null,
        redeemQuote: null,
        issueQuoteStatus: "idle",
        quoteStatus: "idle",
      });
      return;
    }
    const valid = assets.some((a) => a.mint === assetMint);
    if (!valid) {
      set({ assetMint: assets[0].mint });
    }
    get().scheduleIssueQuote();
    get().scheduleRedeemQuote();
  },

  setAssetMint: (mint) => {
    set({ assetMint: mint });
    get().scheduleIssueQuote();
    get().scheduleRedeemQuote();
  },

  setMintAmount: (amount) => {
    set({ mintAmount: amount });
    get().scheduleIssueQuote();
  },

  setRedeemAmount: (amount) => {
    set({ redeemAmount: amount });
    get().scheduleRedeemQuote();
  },

  scheduleIssueQuote: () => {
    const state = get();
    clearTimer(state._issueQuoteTimer);
    const timer = setTimeout(() => {
      set({ _issueQuoteTimer: null });
      void get().fetchIssueQuote();
    }, QUOTE_DEBOUNCE_MS);
    set({ _issueQuoteTimer: timer });
  },

  scheduleRedeemQuote: () => {
    const state = get();
    clearTimer(state._quoteTimer);
    const timer = setTimeout(() => {
      set({ _quoteTimer: null });
      void get().fetchRedeemQuote();
    }, QUOTE_DEBOUNCE_MS);
    set({ _quoteTimer: timer });
  },

  fetchIssueQuote: async () => {
    const generation = get()._issueQuoteGeneration + 1;
    set({ _issueQuoteGeneration: generation });

    const { assetMint, mintAmount } = get();
    const amount = parseTokenAmount(mintAmount, collateralDecimals(assetMint));
    if (!assetMint || amount == null) {
      set({ issueQuote: null, issueQuoteStatus: "idle" });
      return;
    }

    set({ issueQuoteStatus: "loading" });
    try {
      const params = new URLSearchParams({
        amount: String(amount),
        assetMint,
      });
      const quote = await apiGet<IssueQuote>(`/v1/quote/issue?${params.toString()}`);
      if (get()._issueQuoteGeneration !== generation) return;
      set({ issueQuote: quote, issueQuoteStatus: "ready" });
    } catch {
      if (get()._issueQuoteGeneration !== generation) return;
      set({ issueQuote: null, issueQuoteStatus: "idle" });
    }
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
      get().scheduleIssueQuote();
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
