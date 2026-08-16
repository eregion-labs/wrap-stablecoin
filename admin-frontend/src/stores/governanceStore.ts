"use client";

import { create } from "zustand";
import { apiPost } from "@/lib/api";
import { signAndSendUnsignedTx } from "@/lib/signLocalTx";
import { actionErr, actionOk, type ActionResult } from "./types";
import { useVaultStore } from "./vaultStore";

export type GovernanceBusy =
  | "pause"
  | "wrapPublic"
  | "unwrapPublic"
  | "initAllowlist"
  | "addAllowlist"
  | "removeAllowlist"
  | "transferAdmin"
  | "cancelTransferAdmin"
  | "acceptAdmin"
  | "proposeMintAuth"
  | "cancelMintAuth"
  | "acceptMintAuth"
  | "enableKlend"
  | null;

export type EnableKlendDraft = {
  lendingMarket: string;
  reserve: string;
  reserveLiquiditySupply: string;
  collateralMint: string;
};

type GovernanceState = {
  allowlistMember: string;
  newAdmin: string;
  newMintAuthority: string;
  enableKlendDrafts: Record<string, EnableKlendDraft>;
  busy: GovernanceBusy;
  busyMint: string | null;
  busyMember: string | null;

  reset: () => void;
  setAllowlistMember: (value: string) => void;
  setNewAdmin: (value: string) => void;
  setNewMintAuthority: (value: string) => void;
  setEnableKlendDraft: (mint: string, patch: Partial<EnableKlendDraft>) => void;

  setPaused: (value: boolean) => Promise<ActionResult<{ signature: string }>>;
  setWrapPublic: (value: boolean) => Promise<ActionResult<{ signature: string }>>;
  setUnwrapPublic: (value: boolean) => Promise<ActionResult<{ signature: string }>>;
  initAllowlist: () => Promise<ActionResult<{ signature: string }>>;
  addToAllowlist: () => Promise<ActionResult<{ signature: string; count: number }>>;
  removeFromAllowlist: (pubkey: string) => Promise<ActionResult<{ signature: string }>>;
  transferAuthority: () => Promise<ActionResult<{ signature: string }>>;
  cancelTransferAuthority: () => Promise<ActionResult<{ signature: string }>>;
  acceptAuthority: (opts: {
    secretKey: Uint8Array;
    rpcUrl: string;
  }) => Promise<ActionResult<{ signature: string }>>;
  proposeMintAuthority: () => Promise<ActionResult<{ signature: string }>>;
  cancelProposeMintAuthority: () => Promise<ActionResult<{ signature: string }>>;
  acceptMintAuthority: (opts: {
    secretKey: Uint8Array;
    rpcUrl: string;
  }) => Promise<ActionResult<{ signature: string }>>;
  enableKlend: (mint: string) => Promise<ActionResult<{ signature: string }>>;
};

const emptyEnableDraft: EnableKlendDraft = {
  lendingMarket: "",
  reserve: "",
  reserveLiquiditySupply: "",
  collateralMint: "",
};

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

function requirePubkey(raw: string, label: string): ActionResult<string> {
  const pubkey = raw.trim();
  if (pubkey.length < 32) {
    return actionErr(`${label} pubkey is required`);
  }
  return actionOk(pubkey);
}

export const useGovernanceStore = create<GovernanceState>()((set, get) => ({
  allowlistMember: "",
  newAdmin: "",
  newMintAuthority: "",
  enableKlendDrafts: {},
  busy: null,
  busyMint: null,
  busyMember: null,

  reset: () =>
    set({
      allowlistMember: "",
      newAdmin: "",
      newMintAuthority: "",
      enableKlendDrafts: {},
      busy: null,
      busyMint: null,
      busyMember: null,
    }),

  setAllowlistMember: (value) => set({ allowlistMember: value }),
  setNewAdmin: (value) => set({ newAdmin: value }),
  setNewMintAuthority: (value) => set({ newMintAuthority: value }),
  setEnableKlendDraft: (mint, patch) => {
    const current = get().enableKlendDrafts[mint] ?? emptyEnableDraft;
    set({
      enableKlendDrafts: {
        ...get().enableKlendDrafts,
        [mint]: { ...current, ...patch },
      },
    });
  },

  setPaused: async (value) => {
    set({ busy: "pause" });
    try {
      return await postAndRefresh("/v1/admin/set-paused", { value });
    } finally {
      set({ busy: null });
    }
  },

  setWrapPublic: async (value) => {
    set({ busy: "wrapPublic" });
    try {
      return await postAndRefresh("/v1/admin/set-wrap-public", { value });
    } finally {
      set({ busy: null });
    }
  },

  setUnwrapPublic: async (value) => {
    set({ busy: "unwrapPublic" });
    try {
      return await postAndRefresh("/v1/admin/set-unwrap-public", { value });
    } finally {
      set({ busy: null });
    }
  },

  initAllowlist: async () => {
    set({ busy: "initAllowlist" });
    try {
      return await postAndRefresh("/v1/admin/init-allowlist", {});
    } finally {
      set({ busy: null });
    }
  },

  addToAllowlist: async () => {
    const existing = new Set(useVaultStore.getState().meta?.allowlist ?? []);
    const lines = get()
      .allowlistMember.split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 32);
    const unique = [...new Set(lines)].filter((pk) => !existing.has(pk));
    if (unique.length === 0) {
      return actionErr("enter one or more new wallet pubkeys (one per line)");
    }
    const cap = 64;
    const used = existing.size;
    if (used + unique.length > cap) {
      return actionErr(`allowlist max is ${cap}; ${used} used, ${unique.length} new`);
    }
    set({ busy: "addAllowlist" });
    try {
      const { signature, count } = await apiPost<
        { pubkeys: string[] },
        { signature: string; count: number }
      >("/v1/admin/add-to-allowlist", { pubkeys: unique });
      await useVaultStore.getState().refresh();
      set({ allowlistMember: "" });
      return actionOk({ signature, count });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },

  removeFromAllowlist: async (pubkey) => {
    set({ busy: "removeAllowlist", busyMember: pubkey });
    try {
      return await postAndRefresh("/v1/admin/remove-from-allowlist", { pubkey });
    } finally {
      set({ busy: null, busyMember: null });
    }
  },

  transferAuthority: async () => {
    const parsed = requirePubkey(get().newAdmin, "new admin");
    if (!parsed.ok) return parsed;
    set({ busy: "transferAdmin" });
    try {
      return await postAndRefresh("/v1/admin/transfer-authority", {
        newAdmin: parsed.data,
      });
    } finally {
      set({ busy: null });
    }
  },

  cancelTransferAuthority: async () => {
    set({ busy: "cancelTransferAdmin" });
    try {
      return await postAndRefresh("/v1/admin/cancel-transfer-authority", {});
    } finally {
      set({ busy: null });
    }
  },

  acceptAuthority: async ({ secretKey, rpcUrl }) => {
    const pending = useVaultStore.getState().meta?.pendingAdmin;
    if (!pending) return actionErr("no pending admin transfer");
    set({ busy: "acceptAdmin" });
    try {
      const { transactionB64 } = await apiPost<
        Record<string, never>,
        { transactionB64: string }
      >("/v1/admin/accept-authority/tx", {});
      const signature = await signAndSendUnsignedTx({
        transactionB64,
        secretKey,
        rpcUrl,
        expectedSigner: pending,
      });
      await useVaultStore.getState().refresh();
      return actionOk({ signature });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },

  proposeMintAuthority: async () => {
    const parsed = requirePubkey(get().newMintAuthority, "new mint authority");
    if (!parsed.ok) return parsed;
    set({ busy: "proposeMintAuth" });
    try {
      return await postAndRefresh("/v1/admin/propose-mint-authority", {
        newMintAuthority: parsed.data,
      });
    } finally {
      set({ busy: null });
    }
  },

  cancelProposeMintAuthority: async () => {
    set({ busy: "cancelMintAuth" });
    try {
      return await postAndRefresh("/v1/admin/cancel-propose-mint-authority", {});
    } finally {
      set({ busy: null });
    }
  },

  acceptMintAuthority: async ({ secretKey, rpcUrl }) => {
    const pending = useVaultStore.getState().meta?.pendingMintAuthority;
    if (!pending) return actionErr("no pending mint authority transfer");
    set({ busy: "acceptMintAuth" });
    try {
      const { transactionB64 } = await apiPost<
        Record<string, never>,
        { transactionB64: string }
      >("/v1/admin/accept-mint-authority/tx", {});
      const signature = await signAndSendUnsignedTx({
        transactionB64,
        secretKey,
        rpcUrl,
        expectedSigner: pending,
      });
      await useVaultStore.getState().refresh();
      return actionOk({ signature });
    } catch (e) {
      return actionErr((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },

  enableKlend: async (mint) => {
    const draft = get().enableKlendDrafts[mint] ?? emptyEnableDraft;
    const lendingMarket = requirePubkey(draft.lendingMarket, "lending market");
    if (!lendingMarket.ok) return lendingMarket;
    const reserve = requirePubkey(draft.reserve, "reserve");
    if (!reserve.ok) return reserve;
    const supply = requirePubkey(draft.reserveLiquiditySupply, "reserve liquidity supply");
    if (!supply.ok) return supply;
    const collateralMint = requirePubkey(draft.collateralMint, "collateral mint");
    if (!collateralMint.ok) return collateralMint;
    set({ busy: "enableKlend", busyMint: mint });
    try {
      return await postAndRefresh("/v1/admin/enable-klend", {
        assetMint: mint,
        lendingMarket: lendingMarket.data,
        reserve: reserve.data,
        reserveLiquiditySupply: supply.data,
        collateralMint: collateralMint.data,
      });
    } finally {
      set({ busy: null, busyMint: null });
    }
  },
}));
