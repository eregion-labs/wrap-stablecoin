"use client";

import dynamic from "next/dynamic";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { SnackbarProvider } from "notistack";
import { theme } from "@/theme/theme";

const SolanaWalletProviders = dynamic(() => import("./SolanaWalletProviders"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-6 text-sm text-neutral-400">Loading wallet connection…</div>
  ),
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <SolanaWalletProviders>{children}</SolanaWalletProviders>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
