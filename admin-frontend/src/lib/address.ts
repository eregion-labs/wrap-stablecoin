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
  /** From client-config `links.explorerBaseUrl` (default Solscan). */
  explorerBaseUrl?: string;
};

/**
 * Explorer account/tx URL from client-config base.
 * localnet returns null (no public explorer).
 */
export function createExplorerUrl({
  address,
  network,
  type = "account",
  explorerBaseUrl = "https://solscan.io",
}: CreateExplorerUrlOpts): string | null {
  if (network === "localnet") return null;

  const base = explorerBaseUrl.replace(/\/$/, "");

  const path =
    type === "tx" ? `/tx/${address}` : type === "token" ? `/token/${address}` : `/account/${address}`;

  const cluster =
    network === "mainnet" ? "" : `?cluster=${network === "devnet" ? "devnet" : network}`;

  return `${base}${path}${cluster}`;
}
