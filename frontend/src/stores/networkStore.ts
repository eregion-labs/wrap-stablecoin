"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppNetwork = "localnet" | "devnet";

type NetworkState = {
  network: AppNetwork;
  setNetwork: (network: AppNetwork) => void;
};

function defaultNetwork(): AppNetwork {
  const env = (process.env.NEXT_PUBLIC_DEFAULT_NETWORK || "localnet").toLowerCase();
  return env === "devnet" ? "devnet" : "localnet";
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      network: defaultNetwork(),
      setNetwork: (network) => set({ network }),
    }),
    { name: "wstable-network" },
  ),
);

export function appNetworkLabel(network: AppNetwork): string {
  return network === "localnet" ? "Localnet" : "Devnet";
}
