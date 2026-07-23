"use client";

import dynamic from "next/dynamic";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { SnackbarProvider } from "notistack";
import AppShell from "@/components/layout/AppShell";
import ClientConfigProvider from "@/providers/ClientConfigProvider";
import { theme } from "@/theme/theme";

const SolanaWalletProviders = dynamic(() => import("./SolanaWalletProviders"), {
  ssr: false,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <ClientConfigProvider>
          <SolanaWalletProviders>
            <AppShell>{children}</AppShell>
          </SolanaWalletProviders>
        </ClientConfigProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
