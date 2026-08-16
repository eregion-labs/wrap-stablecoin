"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useClientConfig } from "@/providers/ClientConfigProvider";

/**
 * Wallet Standard + Wallet Adapter. Empty `wallets` → standard wallets are merged
 * in by WalletProvider via useStandardWalletAdapters.
 *
 * Do not mount <WalletModal /> here — WalletModalProvider renders it when open.
 * RPC endpoint comes from frozen backend client-config (not env / network switch).
 */
export default function SolanaWalletProviders({ children }: { children: React.ReactNode }) {
  const config = useClientConfig();
  const endpoint = config.solana.rpcUrl;
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider key={endpoint} endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
