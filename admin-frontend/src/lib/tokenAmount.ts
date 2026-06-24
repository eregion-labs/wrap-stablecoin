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
