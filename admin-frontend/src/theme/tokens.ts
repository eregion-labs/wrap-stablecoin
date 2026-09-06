/** Florin design language — Florence editorial (live florence-app). */

export const paper = "#FFFFFF";
export const offWhite = "#F7F6F4";
export const mutedWash = "#F0EFED";
export const hairline = "#DEDEDE";

export const florentineRed = "#C2192B";
export const civicBlue = "#4A90B8";
export const accentBrown = "#8A5E3A";

export const ledgerInk = "#0E0E0E";
export const textMuted = "#6B6B6B";
export const textDisabled = "#AFAFAF";

export const colorSuccess = "#2E9E5B";
export const colorWarning = florentineRed;
export const colorError = florentineRed;
export const colorInfo = civicBlue;

/** Titles, wordmark, italic descriptions. */
export const serifStack = 'var(--font-eb-garamond), "EB Garamond", Georgia, serif';
/** Body, tables, figures, amounts, forms, nav. */
export const sansStack = "var(--font-inter), system-ui, sans-serif";
/** Addresses, mint IDs, signatures, code — not amounts. */
export const monoStack = 'var(--font-dm-mono), "DM Mono", ui-monospace, monospace';

export const border = `1px solid ${hairline}`;
export const borderSubtle = `1px solid ${hairline}`;

export const cardShadow = "none";
export const focusRing = `0 0 0 2px ${florentineRed}33`;

export const gradientBg = paper;

/**
 * Layout surfaces (Scan / Explain / Act). Pick one before adding maxWidth.
 *
 * - Page column (1800): hosts Scan. pageColumnSx.
 * - Scan: tables / ledgers — fill the page column; overflow-x only after the window is used.
 * - Explain: prose — layout.explain (640) or layout.explainLong (720), left.
 * - Act page: whole-page compose / settings — actPageSx (960, centered).
 * - Act block: Act under Scan (e.g. yield ops) — actBlockSx (960, left; no mx auto).
 *
 * Never invent 1100 / 1280. Never give Act Scan width. Never give Scan Act width.
 */
export const layout = { page: 1800, act: 960, explain: 640, explainLong: 720 } as const;
export const pageGutterSx = { px: { xs: 2, sm: 3 } };
export const pageColumnSx = {
  width: "100%",
  maxWidth: layout.page,
  mx: "auto",
  ...pageGutterSx,
};
export const actPageSx = {
  width: "100%",
  maxWidth: layout.act,
  mx: "auto",
  ...pageGutterSx,
};
export const actBlockSx = {
  width: "100%",
  maxWidth: layout.act,
};

/** Hairline paper card — no shadow, 1px corners. */
export const cardSx = {
  p: 2,
  mb: 3,
  borderRadius: "1px",
  bgcolor: paper,
  border,
  boxShadow: "none",
  overflowX: "auto",
};

/** Mint / redeem action card — 3px Florentine red top bar. */
export const actionCardSx = {
  ...cardSx,
  borderTop: `3px solid ${florentineRed}`,
};

export const sectionLabelSx = {
  fontFamily: sansStack,
  fontSize: "10px",
  letterSpacing: "0.22em",
  color: florentineRed,
  textTransform: "uppercase" as const,
  mb: "10px",
};

/** Addresses, mint IDs, signatures — not amounts or buttons. */
export const monoSx = {
  fontFamily: monoStack,
} as const;

export const redRuleSx = {
  height: "1px",
  bgcolor: florentineRed,
  width: "100%",
  mb: 2,
};

/** CSS custom properties mirrored in florin-globals.css */
export const cssVars = {
  "--florin-paper": paper,
  "--florin-offwhite": offWhite,
  "--florin-muted": mutedWash,
  "--florin-hairline": hairline,
  "--florin-red": florentineRed,
  "--florin-blue": civicBlue,
  "--florin-brown": accentBrown,
  "--florin-ink": ledgerInk,
  "--florin-text-muted": textMuted,
  "--florin-border": hairline,
  "--background": paper,
  "--foreground": ledgerInk,
} as const;
