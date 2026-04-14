const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8080";

export type SolanaNetworkHeader = "localnet" | "devnet" | "mainnet";

export function solanaNetworkHeader(): SolanaNetworkHeader {
  const n = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet").toLowerCase();
  if (n === "mainnet" || n === "mainnet-beta") return "mainnet";
  if (n === "localnet") return "localnet";
  return "devnet";
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
