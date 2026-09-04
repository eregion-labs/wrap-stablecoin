/** Known collateral mints for display labels. */
export const MINT_LABELS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  ccc58277Rfo3mCue4aHD3RcUfQzw8PoNSXimfNMnDqu: "CCC",
  tttv7GkTAwb1pE6J2Gb3xghGcTXfxrk5B7cM8G2QNWR: "TTT",
  EeqAYGL6ssfa6X2HFXySw9cEynBve8KP5Zxqzye5wgci: "tUSDA",
  GztP9HT346NwALEnsEuqMMZxmBxak2RsoefUir8GLV1v: "tUSDB",
  "7DfHyL9m8fohj5ysB4HhSCHDu4c8VGtA1KNjsgC1sqxe": "tUSD1",
  "2PVnHCsrkrHAyrk6CDZ1nuWogEQBjDmD3t6nz27s3ya7": "tUSD2",
  "9s2ByyX8a6qjN6sJnJYH5wb2ysLDHxWLeK7Ve7rv3WB6": "tUSD3",
  "9vJgRZSie62MyK259Ypo5evW5pVdcXAeFsNr4NgV6dBc": "tUSD4",
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
