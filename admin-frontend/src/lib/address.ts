/** Truncate a Solana address: first 7 + … + last 7. */
export function truncateAddrStandard(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 7)}…${address.slice(-7)}`;
}

/** Short truncations for chart labels / tooltips. */
export function truncateAddrShort(address: string, head: number, tail: number): string {
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export type ExplorerAccountType = "account" | "tx" | "token";

type CreateExplorerUrlOpts = {
  address: string;
  network: "localnet" | "devnet" | "mainnet";
  type?: ExplorerAccountType;
};

/**
 * Solscan (or NEXT_PUBLIC_SOLANA_EXPLORER_URL) account/tx URL.
 * localnet returns null (no public explorer).
 */
export function createExplorerUrl({
  address,
  network,
  type = "account",
}: CreateExplorerUrlOpts): string | null {
  if (network === "localnet") return null;

  const base = (
    process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL || "https://solscan.io"
  ).replace(/\/$/, "");

  const path =
    type === "tx" ? `/tx/${address}` : type === "token" ? `/token/${address}` : `/account/${address}`;

  const cluster =
    network === "mainnet" ? "" : `?cluster=${network === "devnet" ? "devnet" : network}`;

  return `${base}${path}${cluster}`;
}
