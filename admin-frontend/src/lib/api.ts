import { useNetworkStore } from "@/stores/networkStore";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8080";

export type SolanaNetworkHeader = "localnet" | "devnet" | "mainnet";

/** Cluster header sent to the backend — driven by the in-app network switch. */
export function solanaNetworkHeader(): SolanaNetworkHeader {
  return useNetworkStore.getState().network;
}

export async function apiGet<TRes>(path: string): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-solana-network": solanaNetworkHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as TRes;
}

export async function apiPost<TBody extends object, TRes>(
  path: string,
  body: TBody,
): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-solana-network": solanaNetworkHeader(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as TRes;
}
