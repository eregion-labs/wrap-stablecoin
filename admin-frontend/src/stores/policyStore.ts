"use client";

import { create } from "zustand";
import { apiPost } from "@/lib/api";
import { atomsToInputAmount, parseTokenAmountOrZero } from "@/lib/tokenAmount";
import { requirePubkey } from "@/lib/pubkey";
import { getApplicationServices } from "@/providers/ClientConfigProvider";
import type { AssetStatus, VaultAsset, VaultSummary } from "@/types/vault";
import { MAX_REGISTERED_ASSETS, selectAssetByMint, selectRowMints } from "./selectors";
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

export type RegisterAssetOpts = {
  mintEnabled?: boolean;
  redeemEnabled?: boolean;
};

function assetToDraft(mint: string, asset?: VaultAsset): PolicyDraft {
  const decimals = asset?.tokenDecimals ?? 6;
  return {
    mint,
    registered: asset != null,
    mintEnabled: asset?.mintEnabled ?? true,
    redeemEnabled: asset?.redeemEnabled ?? true,
    mintHaircutBps: String(asset?.mintHaircutBps ?? 0),
    redemptionHaircutBps: String(asset?.redemptionHaircutBps ?? 0),
    mintCap: atomsToInputAmount(asset?.mintCap ?? 0, decimals),
    exposureCap: atomsToInputAmount(asset?.exposureCap ?? 0, decimals),
    minLiquidityTarget: atomsToInputAmount(asset?.minLiquidityTarget ?? 0, decimals),
    assetStatus: (asset?.assetStatus as AssetStatus) ?? "active",
  };
}

function includeCatalogMints(): boolean {
  try {
    return getApplicationServices().config.solana.network === "localnet";
  } catch {
    return false;
  }
}

function buildDrafts(summary: VaultSummary | null): Record<string, PolicyDraft> {
  const assets = selectAssetByMint(summary);
  const drafts: Record<string, PolicyDraft> = {};
  for (const mint of selectRowMints(summary, { includeCatalog: includeCatalogMints() })) {
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
  registerAsset: (
    mint: string,
    opts?: RegisterAssetOpts,
  ) => Promise<ActionResult<{ signature: string }>>;
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

  registerAsset: async (mint, opts) => {
    const parsed = requirePubkey(mint, "asset mint");
    if (!parsed.ok) return parsed;
    const assetMint = parsed.data;

    const summary = useVaultStore.getState().summary;
    if (!summary) return actionErr("vault not loaded");
    if (summary.assets.some((a) => a.mint === assetMint)) {
      return actionErr("asset already registered");
    }
    if (summary.wrappedMint === assetMint) {
      return actionErr("cannot register the wrapped mint as collateral");
    }
    if (summary.assets.length >= MAX_REGISTERED_ASSETS) {
      return actionErr(`vault already has the maximum of ${MAX_REGISTERED_ASSETS} assets`);
    }

    const draft = get().drafts[assetMint];
    const mintEnabled = opts?.mintEnabled ?? draft?.mintEnabled ?? true;
    const redeemEnabled = opts?.redeemEnabled ?? draft?.redeemEnabled ?? true;

    set({ busyMint: assetMint });
    try {
      const { signature } = await apiPost<
        { assetMint: string; mintEnabled: boolean; redeemEnabled: boolean },
        { signature: string }
      >("/v1/admin/register-asset", {
        assetMint,
        mintEnabled,
        redeemEnabled,
      });

      set((state) => {
        const { [assetMint]: _, ...restDirty } = state.dirtyMints;
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

    const summary = useVaultStore.getState().summary;
    const decimals =
      summary?.assets.find((a) => a.mint === mint)?.tokenDecimals ?? 6;
    const mintCap = parseTokenAmountOrZero(draft.mintCap, decimals);
    const exposureCap = parseTokenAmountOrZero(draft.exposureCap, decimals);
    const minLiquidityTarget = parseTokenAmountOrZero(draft.minLiquidityTarget, decimals);
    if (mintCap == null || exposureCap == null || minLiquidityTarget == null) {
      return actionErr("invalid cap or liquidity amount");
    }

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
        mintCap,
        exposureCap,
        minLiquidityTarget,
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
