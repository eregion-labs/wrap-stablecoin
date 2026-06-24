"use client";

import { create } from "zustand";
import { apiPost } from "@/lib/api";
import type { AssetStatus, VaultAsset, VaultSummary } from "@/types/vault";
import { selectAssetByMint, selectRowMints } from "./selectors";
import { actionErr, actionOk, type ActionResult } from "./types";
import { useVaultStore } from "./vaultStore";

export type PolicyDraft = {
  mint: string;
  registered: boolean;
  mintEnabled: boolean;
  redeemEnabled: boolean;
  mintHaircutBps: string;
  redemptionHaircutBps: string;
  mintCap: string;
  exposureCap: string;
  minLiquidityTarget: string;
  assetStatus: AssetStatus;
};

function assetToDraft(mint: string, asset?: VaultAsset): PolicyDraft {
  return {
    mint,
    registered: asset != null,
    mintEnabled: asset?.mintEnabled ?? true,
    redeemEnabled: asset?.redeemEnabled ?? true,
    mintHaircutBps: String(asset?.mintHaircutBps ?? 0),
    redemptionHaircutBps: String(asset?.redemptionHaircutBps ?? 0),
    mintCap: String(asset?.mintCap ?? 0),
    exposureCap: String(asset?.exposureCap ?? 0),
    minLiquidityTarget: String(asset?.minLiquidityTarget ?? 0),
    assetStatus: (asset?.assetStatus as AssetStatus) ?? "active",
  };
}

function buildDrafts(summary: VaultSummary | null): Record<string, PolicyDraft> {
  const assets = selectAssetByMint(summary);
  const drafts: Record<string, PolicyDraft> = {};
  for (const mint of selectRowMints(summary)) {
    drafts[mint] = assetToDraft(mint, assets.get(mint));
  }
  return drafts;
}

type PolicyState = {
  drafts: Record<string, PolicyDraft>;
  /** Mints with unsaved local edits — preserved across vault refresh. */
  dirtyMints: Record<string, true>;
  busyMint: string | null;

  reset: () => void;
  syncFromSummary: (summary: VaultSummary | null) => void;
  updateDraft: (mint: string, patch: Partial<PolicyDraft>) => void;
  registerAsset: (mint: string) => Promise<ActionResult<{ signature: string }>>;
  savePolicy: (mint: string) => Promise<ActionResult<{ signature: string }>>;
};

const initialPolicyState = {
  drafts: {} as Record<string, PolicyDraft>,
  dirtyMints: {} as Record<string, true>,
  busyMint: null as string | null,
};

export const usePolicyStore = create<PolicyState>()((set, get) => ({
  ...initialPolicyState,

  reset: () => set({ ...initialPolicyState }),

  syncFromSummary: (summary) => {
    const next = buildDrafts(summary);
    const { dirtyMints, drafts } = get();
    const merged = { ...next };
    for (const mint of Object.keys(dirtyMints)) {
      if (drafts[mint]) merged[mint] = drafts[mint];
    }
    set({ drafts: merged });
  },

  updateDraft: (mint, patch) => {
    set((state) => ({
      drafts: {
        ...state.drafts,
        [mint]: { ...state.drafts[mint], ...patch },
      },
      dirtyMints: { ...state.dirtyMints, [mint]: true },
    }));
  },

  registerAsset: async (mint) => {
    const draft = get().drafts[mint];
    if (!draft) return actionErr("unknown asset");

    set({ busyMint: mint });
    try {
      const { signature } = await apiPost<
        { assetMint: string; mintEnabled: boolean; redeemEnabled: boolean },
        { signature: string }
      >("/v1/admin/register-asset", {
        assetMint: mint,
        mintEnabled: draft.mintEnabled,
        redeemEnabled: draft.redeemEnabled,
      });

      set((state) => {
        const { [mint]: _, ...restDirty } = state.dirtyMints;
        return { dirtyMints: restDirty };
      });
      await useVaultStore.getState().refresh();
      return actionOk({ signature });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busyMint: null });
    }
  },

  savePolicy: async (mint) => {
    const draft = get().drafts[mint];
    if (!draft) return actionErr("unknown asset");

    set({ busyMint: mint });
    try {
      const { signature } = await apiPost<
        {
          assetMint: string;
          mintEnabled: boolean;
          redeemEnabled: boolean;
          mintHaircutBps: number;
          redemptionHaircutBps: number;
          mintCap: number;
          exposureCap: number;
          minLiquidityTarget: number;
          assetStatus: string;
        },
        { signature: string }
      >("/v1/admin/update-asset-policy", {
        assetMint: mint,
        mintEnabled: draft.mintEnabled,
        redeemEnabled: draft.redeemEnabled,
        mintHaircutBps: Number(draft.mintHaircutBps) || 0,
        redemptionHaircutBps: Number(draft.redemptionHaircutBps) || 0,
        mintCap: Number(draft.mintCap) || 0,
        exposureCap: Number(draft.exposureCap) || 0,
        minLiquidityTarget: Number(draft.minLiquidityTarget) || 0,
        assetStatus: draft.assetStatus,
      });

      set((state) => {
        const { [mint]: _, ...restDirty } = state.dirtyMints;
        return { dirtyMints: restDirty };
      });
      await useVaultStore.getState().refresh();
      return actionOk({ signature });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busyMint: null });
    }
  },
}));
