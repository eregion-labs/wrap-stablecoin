/** Format raw token atoms with fixed decimals for display. */
export function formatTokenAmount(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";
  const value = amount / 10 ** decimals;
  const maxFrac = Math.min(decimals, 6);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
}

/** Parse a human decimal string into token atoms. */
export function parseTokenAmount(raw: string, decimals: number): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  const atoms = Math.round(n * 10 ** decimals);
  if (!Number.isFinite(atoms) || atoms <= 0) return null;
  return atoms;
}

export function haircutPercent(bps: number): string {
  return `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
