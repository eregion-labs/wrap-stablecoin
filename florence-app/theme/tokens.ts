/** Florin design language — Renaissance merchant-republic palette. */

export const ivory = "#F7F3EB";
export const parchment = "#EFE6D2";
export const marble = "#E4DED3";
export const stone = "#B8B1A4";

export const florinGold = "#C6A44A";
export const republicBronze = "#8A6742";
export const merchantCopper = "#A86B3D";

export const ledgerInk = "#202020";
export const textMuted = "#5C574E";
export const textDisabled = "#9A9488";

export const venetianGreen = "#21594D";
export const florentineRed = "#873A35";
export const deepIndigo = "#29344B";

export const border = `1px solid ${republicBronze}`;
export const borderSubtle = `1px solid ${stone}`;

export const colorSuccess = venetianGreen;
export const colorWarning = merchantCopper;
export const colorError = florentineRed;
export const colorInfo = deepIndigo;

export const cardShadow = "0 2px 12px rgba(32, 32, 32, 0.08)";
export const focusRing = `0 0 0 2px ${florinGold}55`;

export const gradientBg = `
  linear-gradient(180deg, ${ivory} 0%, ${parchment} 100%)
`;

/** Marble slab card — no glassmorphism. */
export const cardSx = {
  p: 2,
  mb: 3,
  borderRadius: "10px",
  bgcolor: marble,
  border: border,
  boxShadow: cardShadow,
  overflowX: "auto",
};

/** CSS custom properties mirrored in florin-globals.css */
export const cssVars = {
  "--florin-ivory": ivory,
  "--florin-parchment": parchment,
  "--florin-marble": marble,
  "--florin-stone": stone,
  "--florin-gold": florinGold,
  "--florin-bronze": republicBronze,
  "--florin-ink": ledgerInk,
  "--florin-text-muted": textMuted,
  "--florin-border": republicBronze,
  "--background": ivory,
  "--foreground": ledgerInk,
} as const;
