"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { useMemo } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModal, WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";

function adapterNetwork(): WalletAdapterNetwork {
  const n = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet").toLowerCase();
  if (n === "mainnet" || n === "mainnet-beta") return WalletAdapterNetwork.Mainnet;
  if (n === "testnet") return WalletAdapterNetwork.Testnet;
  return WalletAdapterNetwork.Devnet;
}

function rpcEndpoint(network: WalletAdapterNetwork): string {
  const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (custom) return custom;
  if (network === WalletAdapterNetwork.Mainnet) return "https://api.mainnet-beta.solana.com";
  return "https://api.devnet.solana.com";
}

export default function SolanaWalletProviders({ children }: { children: React.ReactNode }) {
  const network = useMemo(() => adapterNetwork(), []);
  const endpoint = useMemo(() => rpcEndpoint(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter({ network })], [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
          <WalletModal />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
