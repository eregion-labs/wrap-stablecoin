import { createTheme } from "@mui/material/styles";
import {
  accentBrown,
  civicBlue,
  colorError,
  colorInfo,
  colorSuccess,
  colorWarning,
  florentineRed,
  focusRing,
  hairline,
  ledgerInk,
  mutedWash,
  offWhite,
  paper,
  textDisabled,
  textMuted,
} from "./tokens";

const serifStack = 'var(--font-eb-garamond), "EB Garamond", Georgia, serif';
const sansStack = "var(--font-inter), system-ui, sans-serif";
const monoStack = 'var(--font-dm-mono), "DM Mono", ui-monospace, monospace';

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: civicBlue,
      light: "#6AA8C8",
      dark: "#3A7FA8",
      contrastText: paper,
    },
    secondary: {
      main: florentineRed,
      light: "#E85F6B",
      dark: "#9A1422",
      contrastText: paper,
    },
    info: {
      main: colorInfo,
      contrastText: paper,
    },
    background: {
      default: paper,
      paper: offWhite,
    },
    divider: hairline,
    text: {
      primary: ledgerInk,
      secondary: textMuted,
      disabled: textDisabled,
    },
    success: { main: colorSuccess, contrastText: paper },
    warning: { main: colorWarning, contrastText: paper },
    error: { main: colorError, contrastText: paper },
    action: {
      hover: "rgba(14, 14, 14, 0.04)",
      selected: "rgba(194, 25, 43, 0.08)",
      disabled: textDisabled,
      disabledBackground: mutedWash,
    },
  },
  typography: {
    fontFamily: sansStack,
    h4: { fontFamily: serifStack, fontWeight: 400, letterSpacing: "-0.01em" },
    h5: {
      fontFamily: serifStack,
      fontWeight: 400,
      letterSpacing: "-0.02em",
      fontSize: "1.75rem",
      lineHeight: 1.2,
      color: ledgerInk,
    },
    h6: {
      fontFamily: serifStack,
      fontWeight: 400,
      letterSpacing: "-0.01em",
      color: ledgerInk,
    },
    body1: { fontSize: "1rem", lineHeight: 1.5, fontVariantNumeric: "tabular-nums" },
    body2: { fontSize: "0.875rem", lineHeight: 1.43, fontVariantNumeric: "tabular-nums" },
    subtitle1: { fontWeight: 500 },
    subtitle2: {
      fontFamily: sansStack,
      fontWeight: 500,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      fontSize: "0.625rem",
      lineHeight: 1.33,
      color: florentineRed,
    },
    caption: { fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.33 },
    button: {
      fontFamily: sansStack,
      fontWeight: 500,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      fontSize: "0.6875rem",
    },
  },
  shape: { borderRadius: 1 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontVariantNumeric: "tabular-nums",
        },
        "code, kbd, pre": {
          fontFamily: monoStack,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: paper,
          borderBottom: `1px solid ${hairline}`,
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "uppercase",
          fontWeight: 500,
          letterSpacing: "0.14em",
          fontSize: "0.6875rem",
          borderRadius: "1px",
          "&:focus-visible": {
            outline: "none",
            boxShadow: focusRing,
          },
          "&:active": {
            transform: "scale(0.98)",
          },
        },
        containedPrimary: {
          backgroundColor: civicBlue,
          color: paper,
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "#3A7FA8",
            boxShadow: "none",
          },
          "&.Mui-disabled": {
            backgroundColor: mutedWash,
            color: textDisabled,
          },
        },
        containedSecondary: {
          backgroundColor: florentineRed,
          color: paper,
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "#9A1422",
            boxShadow: "none",
          },
        },
        outlined: {
          background: "transparent",
          borderColor: ledgerInk,
          color: ledgerInk,
          "&:hover": {
            background: ledgerInk,
            borderColor: ledgerInk,
            color: paper,
          },
        },
        text: {
          color: textMuted,
          letterSpacing: "0.1em",
          "&:hover": {
            background: "transparent",
            color: ledgerInk,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: paper,
          borderRadius: "1px",
          boxShadow: "none",
        },
        outlined: {
          border: `1px solid ${hairline}`,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: "1px",
            backgroundColor: offWhite,
            fontFamily: monoStack,
            "& fieldset": {
              borderColor: hairline,
            },
            "&:hover fieldset": {
              borderColor: ledgerInk,
            },
            "&.Mui-focused fieldset": {
              borderColor: florentineRed,
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
          background: offWhite,
          border: `1px solid ${hairline}`,
          borderRadius: "1px",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: "none",
          color: textMuted,
          borderRadius: "1px",
          "&.Mui-selected": {
            background: ledgerInk,
            color: paper,
            "&:hover": {
              background: ledgerInk,
            },
          },
          "&:hover": {
            background: mutedWash,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: "1px",
          fontWeight: 500,
          letterSpacing: "0.06em",
        },
        outlined: {
          borderColor: hairline,
          color: textMuted,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "1px",
        },
        standardSuccess: {
          backgroundColor: "rgba(46, 158, 91, 0.1)",
          color: colorSuccess,
          border: `1px solid rgba(46, 158, 91, 0.25)`,
        },
        standardWarning: {
          backgroundColor: "rgba(138, 94, 58, 0.1)",
          color: accentBrown,
          border: `1px solid rgba(138, 94, 58, 0.25)`,
        },
        standardError: {
          backgroundColor: "rgba(194, 25, 43, 0.08)",
          color: colorError,
          border: `1px solid rgba(194, 25, 43, 0.25)`,
        },
        standardInfo: {
          backgroundColor: "rgba(74, 144, 184, 0.1)",
          color: colorInfo,
          border: `1px solid rgba(74, 144, 184, 0.25)`,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: paper,
          border: `1px solid ${hairline}`,
          borderRadius: "1px",
          boxShadow: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: hairline,
          fontVariantNumeric: "tabular-nums",
        },
        head: {
          fontFamily: sansStack,
          fontWeight: 500,
          fontSize: "0.625rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: textMuted,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:nth-of-type(even)": {
            backgroundColor: offWhite,
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: sansStack,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontSize: "0.6875rem",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: florentineRed,
          height: 2,
        },
      },
    },
  },
});
