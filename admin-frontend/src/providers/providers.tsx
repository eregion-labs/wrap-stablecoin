"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { SnackbarProvider } from "notistack";
import StoreBootstrap from "@/components/StoreBootstrap";
import AppShell from "@/components/layout/AppShell";
import ClientConfigProvider from "@/providers/ClientConfigProvider";
import { theme } from "@/theme/theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <ClientConfigProvider>
          <StoreBootstrap />
          <AppShell>{children}</AppShell>
        </ClientConfigProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
