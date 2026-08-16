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
export const colorWarning = accentBrown;
export const colorError = florentineRed;
export const colorInfo = civicBlue;

export const border = `1px solid ${hairline}`;
export const borderSubtle = `1px solid ${hairline}`;

export const cardShadow = "none";
export const focusRing = `0 0 0 2px ${florentineRed}33`;

export const gradientBg = paper;

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
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
  fontSize: "10px",
  letterSpacing: "0.22em",
  color: florentineRed,
  textTransform: "uppercase" as const,
  mb: "10px",
};

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
