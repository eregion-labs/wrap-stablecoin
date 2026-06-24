/** Known collateral mints for display labels. */
export const MINT_LABELS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  ccc58277Rfo3mCue4aHD3RcUfQzw8PoNSXimfNMnDqu: "CCC",
  tttv7GkTAwb1pE6J2Gb3xghGcTXfxrk5B7cM8G2QNWR: "TTT",
};

/** Collateral assets listed for registration / policy. */
export const ADMIN_COLLATERAL_MINTS = [
  "ccc58277Rfo3mCue4aHD3RcUfQzw8PoNSXimfNMnDqu",
  "tttv7GkTAwb1pE6J2Gb3xghGcTXfxrk5B7cM8G2QNWR",
] as const;

export function mintLabel(mint: string): string {
  return MINT_LABELS[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export function shortMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}
