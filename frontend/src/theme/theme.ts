import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#3b82f6",
      light: "#60a5fa",
      dark: "#2563eb",
      contrastText: "#ffffff",
    },
    background: {
      default: "#09090b",
      paper: "#111114",
    },
    divider: "rgba(255, 255, 255, 0.08)",
    text: {
      primary: "#fafafa",
      secondary: "rgba(250, 250, 250, 0.62)",
    },
    success: { main: "#22c55e" },
    warning: { main: "#f59e0b" },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    h5: { fontWeight: 600, letterSpacing: "-0.02em" },
    subtitle2: { fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.6875rem" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(9, 9, 11, 0.72)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
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
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
