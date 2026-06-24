import type { SxProps, Theme } from "@mui/material/styles";

/** wStable design language — single source of truth for colors and surfaces. */

export const bgPrimary = "#070A12";
export const bgSecondary = "#120A1F";
export const surfaceCard = "#111827";
export const surfaceElevated = "#1A2233";

export const solPurple = "#9945FF";
export const solGreen = "#14F195";
export const solBlue = "#00C2FF";

export const textPrimary = "#F8FAFC";
export const textMuted = "#94A3B8";
export const textDisabled = "#64748B";

export const border = "rgba(255, 255, 255, 0.10)";
export const borderStrong = "rgba(255, 255, 255, 0.12)";

export const colorSuccess = "#14F195";
export const colorWarning = "#FACC15";
export const colorError = "#FB7185";

export const gradientBgGlow = `
  radial-gradient(circle at 20% 20%, rgba(153, 69, 255, 0.22), transparent 32%),
  radial-gradient(circle at 80% 10%, rgba(20, 241, 149, 0.16), transparent 28%),
  ${bgPrimary}
`;

export const focusRing = "0 0 0 3px rgba(20, 241, 149, 0.35)";

export const glassCardBackground = "rgba(17, 24, 39, 0.82)";
export const glassCardShadow = "0 24px 80px rgba(0, 0, 0, 0.32)";

/** Memo card spec — glass surface for panels (layout props unchanged). */
export const cardSx: SxProps<Theme> = {
  p: 2,
  mb: 3,
  borderRadius: "24px",
  bgcolor: glassCardBackground,
  border: `1px solid ${border}`,
  boxShadow: glassCardShadow,
  backdropFilter: "blur(20px)",
  overflowX: "auto",
};

/** CSS custom properties mirrored in globals.css */
export const cssVars = {
  "--wstable-bg": bgPrimary,
  "--wstable-bg-secondary": bgSecondary,
  "--wstable-surface-card": surfaceCard,
  "--wstable-surface-elevated": surfaceElevated,
  "--wstable-purple": solPurple,
  "--wstable-green": solGreen,
  "--wstable-blue": solBlue,
  "--wstable-text": textPrimary,
  "--wstable-text-muted": textMuted,
  "--wstable-border": border,
  "--background": bgPrimary,
  "--foreground": textPrimary,
} as const;
