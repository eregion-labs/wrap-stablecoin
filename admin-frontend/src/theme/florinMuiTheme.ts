import { createTheme } from "@mui/material/styles";
import {
  cardShadow,
  colorError,
  colorInfo,
  colorSuccess,
  colorWarning,
  deepIndigo,
  florinGold,
  focusRing,
  ivory,
  ledgerInk,
  marble,
  parchment,
  republicBronze,
  stone,
  textDisabled,
  textMuted,
  venetianGreen,
} from "./tokens";

const serifStack = 'var(--font-cormorant), "Cormorant Garamond", Georgia, serif';
const sansStack = "var(--font-geist-sans), system-ui, sans-serif";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: florinGold,
      light: "#D4B86A",
      dark: "#A88A3A",
      contrastText: ledgerInk,
    },
    secondary: {
      main: republicBronze,
      light: "#A08058",
      dark: "#6B5235",
      contrastText: ivory,
    },
    info: {
      main: deepIndigo,
      contrastText: ivory,
    },
    background: {
      default: ivory,
      paper: marble,
    },
    divider: stone,
    text: {
      primary: ledgerInk,
      secondary: textMuted,
      disabled: textDisabled,
    },
    success: { main: colorSuccess, contrastText: ivory },
    warning: { main: colorWarning, contrastText: ledgerInk },
    error: { main: colorError, contrastText: ivory },
    action: {
      hover: "rgba(138, 103, 66, 0.08)",
      selected: "rgba(198, 164, 74, 0.15)",
      disabled: textDisabled,
      disabledBackground: parchment,
    },
  },
  typography: {
    fontFamily: sansStack,
    h4: { fontFamily: serifStack, fontWeight: 600, letterSpacing: "-0.01em" },
    h5: {
      fontFamily: serifStack,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      fontSize: "1.75rem",
      lineHeight: 1.29,
      color: ledgerInk,
    },
    h6: {
      fontFamily: serifStack,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: ledgerInk,
    },
    body1: { fontSize: "1rem", lineHeight: 1.5, fontVariantNumeric: "tabular-nums" },
    body2: { fontSize: "0.875rem", lineHeight: 1.43, fontVariantNumeric: "tabular-nums" },
    subtitle1: { fontWeight: 600 },
    subtitle2: {
      fontFamily: serifStack,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      fontSize: "0.75rem",
      lineHeight: 1.33,
      color: republicBronze,
    },
    caption: { fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.33 },
  },
  shape: { borderRadius: 10 },
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
          backgroundColor: parchment,
          borderBottom: `1px solid ${republicBronze}`,
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
          "&:focus-visible": {
            outline: "none",
            boxShadow: focusRing,
          },
          "&:active": {
            transform: "translateY(1px)",
          },
        },
        containedPrimary: {
          backgroundColor: florinGold,
          color: ledgerInk,
          border: `1px solid ${republicBronze}`,
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "#B89440",
            boxShadow: "none",
          },
          "&.Mui-disabled": {
            backgroundColor: parchment,
            color: textDisabled,
            borderColor: stone,
          },
        },
        containedSecondary: {
          background: parchment,
          border: `1px solid ${republicBronze}`,
          color: ledgerInk,
          boxShadow: "none",
          "&:hover": {
            background: marble,
            boxShadow: "none",
          },
        },
        outlined: {
          background: ivory,
          borderColor: republicBronze,
          color: ledgerInk,
          "&:hover": {
            background: parchment,
            borderColor: republicBronze,
          },
        },
        text: {
          color: textMuted,
          "&:hover": {
            background: "rgba(138, 103, 66, 0.06)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: marble,
          borderRadius: 10,
          boxShadow: cardShadow,
        },
        outlined: {
          border: `1px solid ${republicBronze}`,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: parchment,
            "& fieldset": {
              borderColor: stone,
            },
            "&:hover fieldset": {
              borderColor: republicBronze,
            },
            "&.Mui-focused fieldset": {
              borderColor: florinGold,
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
          background: parchment,
          border: `1px solid ${stone}`,
          borderRadius: 10,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: "none",
          color: textMuted,
          "&.Mui-selected": {
            background: "rgba(198, 164, 74, 0.2)",
            color: ledgerInk,
            border: `1px solid ${republicBronze}`,
            "&:hover": {
              background: "rgba(198, 164, 74, 0.28)",
            },
          },
          "&:hover": {
            background: "rgba(138, 103, 66, 0.06)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
        outlined: {
          borderColor: stone,
          color: textMuted,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: "rgba(33, 89, 77, 0.1)",
          color: venetianGreen,
          border: `1px solid rgba(33, 89, 77, 0.25)`,
        },
        standardWarning: {
          backgroundColor: "rgba(168, 107, 61, 0.1)",
          color: colorWarning,
          border: `1px solid rgba(168, 107, 61, 0.25)`,
        },
        standardError: {
          backgroundColor: "rgba(135, 58, 53, 0.1)",
          color: colorError,
          border: `1px solid rgba(135, 58, 53, 0.25)`,
        },
        standardInfo: {
          backgroundColor: "rgba(41, 52, 75, 0.08)",
          color: colorInfo,
          border: `1px solid rgba(41, 52, 75, 0.2)`,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: marble,
          border: `1px solid ${republicBronze}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: stone,
          fontVariantNumeric: "tabular-nums",
        },
        head: {
          fontWeight: 600,
          color: republicBronze,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:nth-of-type(even)": {
            backgroundColor: "rgba(239, 230, 210, 0.45)",
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: serifStack,
          fontWeight: 600,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: florinGold,
          height: 2,
        },
      },
    },
  },
});
