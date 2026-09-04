"use client";

import { create } from "zustand";
import { apiPost } from "@/lib/api";
import { parseTokenAmount } from "@/lib/tokenAmount";
import { actionErr, actionOk, type ActionResult } from "./types";
import { useVaultStore } from "./vaultStore";

export type KlendBusy =
  | "deploy"
  | "recall"
  | "recallAll"
  | "harvest"
  | "sweep"
  | "withdrawTreasury"
  | null;

type KlendState = {
  drafts: Record<
    string,
    {
      deployAmount: string;
      recallAmount: string;
      harvestAmount: string;
      sweepAmount: string;
      treasuryAmount: string;
      destination: string;
    }
  >;
  busy: KlendBusy;
  busyMint: string | null;

  reset: () => void;
  setDraft: (
    mint: string,
    patch: Partial<KlendState["drafts"][string]>,
  ) => void;
  submitDeploy: (mint: string) => Promise<ActionResult<{ signature: string }>>;
  submitRecall: (mint: string) => Promise<ActionResult<{ signature: string }>>;
  submitRecallAll: (mint: string) => Promise<ActionResult<{ signature: string }>>;
  submitHarvest: (mint: string) => Promise<ActionResult<{ signature: string }>>;
  submitSweep: (mint: string) => Promise<ActionResult<{ signature: string }>>;
  submitWithdrawTreasury: (mint: string) => Promise<ActionResult<{ signature: string }>>;
};

const emptyDraft = {
  deployAmount: "",
  recallAmount: "",
  harvestAmount: "",
  sweepAmount: "",
  treasuryAmount: "",
  destination: "",
};

function assetDecimals(mint: string): number {
  return (
    useVaultStore.getState().summary?.assets.find((a) => a.mint === mint)?.tokenDecimals ?? 6
  );
}

function parseHumanAtoms(raw: string, mint: string, label: string): ActionResult<number> {
  const amount = parseTokenAmount(raw, assetDecimals(mint));
  if (amount == null) return actionErr(`invalid ${label}`);
  return actionOk(amount);
}

async function postAndRefresh<TBody extends object>(
  path: string,
  body: TBody,
): Promise<ActionResult<{ signature: string }>> {
  try {
    const { signature } = await apiPost<TBody, { signature: string }>(path, body);
    await useVaultStore.getState().refresh();
    return actionOk({ signature });
  } catch (e) {
    return actionErr((e as Error).message);
  }
}

export const useKlendStore = create<KlendState>()((set, get) => ({
  drafts: {},
  busy: null,
  busyMint: null,

  reset: () => set({ drafts: {}, busy: null, busyMint: null }),

  setDraft: (mint, patch) => {
    const current = get().drafts[mint] ?? emptyDraft;
    set({ drafts: { ...get().drafts, [mint]: { ...current, ...patch } } });
  },

  submitDeploy: async (mint) => {
    const draft = get().drafts[mint] ?? emptyDraft;
    const parsed = parseHumanAtoms(draft.deployAmount, mint, "deploy amount");
    if (!parsed.ok) return parsed;
    set({ busy: "deploy", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/deposit-to-klend", {
        assetMint: mint,
        amount: parsed.data,
      });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },

  submitRecall: async (mint) => {
    const draft = get().drafts[mint] ?? emptyDraft;
    const parsed = parseHumanAtoms(draft.recallAmount, mint, "recall amount");
    if (!parsed.ok) return parsed;
    set({ busy: "recall", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/withdraw-from-klend", {
        assetMint: mint,
        collateralAmount: parsed.data,
      });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },

  submitRecallAll: async (mint) => {
    set({ busy: "recallAll", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/withdraw-all-from-klend", { assetMint: mint });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },

  submitHarvest: async (mint) => {
    const draft = get().drafts[mint] ?? emptyDraft;
    const parsed = parseHumanAtoms(draft.harvestAmount, mint, "harvest amount");
    if (!parsed.ok) return parsed;
    set({ busy: "harvest", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/harvest-yield", {
        assetMint: mint,
        collateralAmount: parsed.data,
      });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },

  submitSweep: async (mint) => {
    const draft = get().drafts[mint] ?? emptyDraft;
    const parsed = parseHumanAtoms(draft.sweepAmount, mint, "sweep amount");
    if (!parsed.ok) return parsed;
    set({ busy: "sweep", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/sweep-home-surplus", {
        assetMint: mint,
        amount: parsed.data,
      });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },

  submitWithdrawTreasury: async (mint) => {
    const draft = get().drafts[mint] ?? emptyDraft;
    const parsed = parseHumanAtoms(draft.treasuryAmount, mint, "treasury amount");
    if (!parsed.ok) return parsed;
    const destination = draft.destination.trim();
    if (destination.length < 32) {
      return actionErr("destination wallet pubkey is required");
    }
    set({ busy: "withdrawTreasury", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/withdraw-treasury", {
        assetMint: mint,
        amount: parsed.data,
        destination,
      });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },
}));
