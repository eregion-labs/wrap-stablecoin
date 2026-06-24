"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { resolveRpcEndpoint } from "@/lib/solanaConfig";
import { useNetworkStore } from "@/stores/networkStore";

/**
 * Wallet Standard + Wallet Adapter. Empty `wallets` → standard wallets are merged
 * in by WalletProvider via useStandardWalletAdapters.
 *
 * Do not mount <WalletModal /> here — WalletModalProvider renders it when open.
 */
export default function SolanaWalletProviders({ children }: { children: React.ReactNode }) {
  const network = useNetworkStore((s) => s.network);
  const endpoint = useMemo(() => resolveRpcEndpoint(network), [network]);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider key={endpoint} endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
