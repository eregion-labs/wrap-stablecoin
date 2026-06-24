"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiGet } from "@/lib/api";
import type { VaultMeta, VaultSummary } from "@/types/vault";
import { useNetworkStore } from "@/stores/networkStore";

export function useVaultAdmin() {
  const { publicKey, connected } = useWallet();
  const network = useNetworkStore((s) => s.network);
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [summary, setSummary] = useState<VaultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        apiGet<VaultMeta>("/v1/vault/meta"),
        apiGet<VaultSummary>("/v1/vault/assets"),
      ]);
      setMeta(m);
      setSummary(s);
      setError(null);
    } catch (e) {
      setMeta(null);
      setSummary(null);
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, network]);

  const fallbackAdmin =
    process.env.NEXT_PUBLIC_VAULT_AUTHORITY?.trim() || null;

  const adminPubkey = meta?.admin ?? fallbackAdmin;

  const isAdmin =
    connected &&
    publicKey != null &&
    adminPubkey != null &&
    publicKey.toBase58() === adminPubkey;

  return { meta, summary, isAdmin, adminPubkey, loading, error, refresh };
}
