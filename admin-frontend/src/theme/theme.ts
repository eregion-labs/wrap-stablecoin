import { createTheme } from "@mui/material/styles";
import {
  bgPrimary,
  bgSecondary,
  border,
  borderStrong,
  colorError,
  colorSuccess,
  colorWarning,
  focusRing,
  glassCardBackground,
  glassCardShadow,
  solBlue,
  solGreen,
  solPurple,
  surfaceCard,
  surfaceElevated,
  textDisabled,
  textMuted,
  textPrimary,
} from "./tokens";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: solPurple,
      light: "#B06AFF",
      dark: "#7A2EE6",
      contrastText: bgPrimary,
    },
    secondary: {
      main: solGreen,
      light: "#4FF5AD",
      dark: "#0EC978",
      contrastText: bgPrimary,
    },
    info: {
      main: solBlue,
      contrastText: bgPrimary,
    },
    background: {
      default: bgPrimary,
      paper: surfaceCard,
    },
    divider: border,
    text: {
      primary: textPrimary,
      secondary: textMuted,
      disabled: textDisabled,
    },
    success: { main: colorSuccess, contrastText: bgPrimary },
    warning: { main: colorWarning, contrastText: bgPrimary },
    error: { main: colorError, contrastText: bgPrimary },
    action: {
      hover: "rgba(255, 255, 255, 0.06)",
      selected: "rgba(153, 69, 255, 0.15)",
      disabled: textDisabled,
      disabledBackground: "rgba(255, 255, 255, 0.06)",
    },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    body1: { fontSize: "1rem", lineHeight: 1.5, fontVariantNumeric: "tabular-nums" },
    body2: { fontSize: "0.875rem", lineHeight: 1.43, fontVariantNumeric: "tabular-nums" },
    h5: { fontWeight: 650, letterSpacing: "-0.02em", fontSize: "1.75rem", lineHeight: 1.29 },
    h6: { fontWeight: 600, letterSpacing: "-0.01em" },
    subtitle1: { fontWeight: 600 },
    subtitle2: {
      fontWeight: 500,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      fontSize: "0.75rem",
      lineHeight: 1.33,
    },
    caption: { fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.33 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: `${bgSecondary}B8`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${border}`,
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 16,
          "&:focus-visible": {
            outline: "none",
            boxShadow: focusRing,
          },
        },
        containedPrimary: {
          backgroundColor: solPurple,
          color: textPrimary,
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "#7A2EE6",
            boxShadow: "none",
          },
          "&.Mui-disabled": {
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            color: textDisabled,
          },
        },
        containedSecondary: {
          background: "rgba(255, 255, 255, 0.08)",
          border: `1px solid ${borderStrong}`,
          color: textPrimary,
          boxShadow: "none",
          "&:hover": {
            background: "rgba(255, 255, 255, 0.12)",
            boxShadow: "none",
          },
        },
        outlined: {
          background: "rgba(255, 255, 255, 0.06)",
          borderColor: borderStrong,
          color: textPrimary,
          "&:hover": {
            background: "rgba(255, 255, 255, 0.08)",
            borderColor: solPurple,
          },
        },
        text: {
          color: textMuted,
          "&:hover": {
            background: "rgba(255, 255, 255, 0.06)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: glassCardBackground,
          backdropFilter: "blur(20px)",
          borderRadius: 24,
          boxShadow: glassCardShadow,
        },
        outlined: {
          border: `1px solid ${border}`,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 20,
            backgroundColor: "rgba(255, 255, 255, 0.045)",
            "& fieldset": {
              borderColor: border,
            },
            "&:hover fieldset": {
              borderColor: borderStrong,
            },
            "&.Mui-focused fieldset": {
              borderColor: solPurple,
            },
            "&.Mui-focused": {
              boxShadow: focusRing,
            },
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          background: "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${border}`,
          borderRadius: 12,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: "none",
          color: textMuted,
          "&.Mui-selected": {
            background: "rgba(153, 69, 255, 0.18)",
            color: textPrimary,
            border: `1px solid rgba(153, 69, 255, 0.35)`,
            "&:hover": {
              background: "rgba(153, 69, 255, 0.24)",
            },
          },
          "&:hover": {
            background: "rgba(255, 255, 255, 0.06)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 500,
        },
        outlined: {
          borderColor: borderStrong,
          color: textMuted,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: "rgba(20, 241, 149, 0.12)",
          color: colorSuccess,
          border: `1px solid rgba(20, 241, 149, 0.25)`,
        },
        standardWarning: {
          backgroundColor: "rgba(250, 204, 21, 0.12)",
          color: colorWarning,
          border: `1px solid rgba(250, 204, 21, 0.25)`,
        },
        standardError: {
          backgroundColor: "rgba(251, 113, 133, 0.12)",
          color: colorError,
          border: `1px solid rgba(251, 113, 133, 0.25)`,
        },
        standardInfo: {
          backgroundColor: "rgba(0, 194, 255, 0.12)",
          color: solBlue,
          border: `1px solid rgba(0, 194, 255, 0.25)`,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: surfaceElevated,
          border: `1px solid ${border}`,
          backdropFilter: "blur(20px)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: border,
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
  },
});
