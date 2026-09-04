/** Format raw token atoms with fixed decimals for display. */
export function formatTokenAmount(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";
  const value = amount / 10 ** decimals;
  const maxFrac = Math.min(Math.max(decimals, 0), 8);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
}

/**
 * Format an API amount string for display.
 * Integer strings are atoms; a decimal point means the value is already human
 * (RPC `uiAmountString`, e.g. `"0.051"`).
 */
export function formatApiTokenAmount(raw: string, decimals: number): string {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return "—";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (trimmed.includes(".")) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(Math.max(decimals, 0), 8),
    });
  }
  return formatTokenAmount(n, decimals);
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

/** Human amount of 0 (including empty) — used for unlimited caps. */
export function parseTokenAmountOrZero(raw: string, decimals: number): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return parseTokenAmount(trimmed, decimals);
}

/** Format raw token atoms as a Max-button input string (no grouping separators). */
export function atomsToInputAmount(atoms: number, decimals: number): string {
  if (!Number.isFinite(atoms) || atoms <= 0) return "0";
  const scale = 10 ** decimals;
  const rounded = Math.round(atoms);
  const whole = Math.floor(rounded / scale);
  const frac = Math.round(rounded - whole * scale);
  if (frac === 0) return String(whole);
  const fracStr = String(frac).padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
