import type { AppNetwork } from "@/stores/networkStore";

/** RPC endpoint for wallet + read calls on the selected cluster. */
export function resolveRpcEndpoint(network: AppNetwork): string {
  if (network === "localnet") {
    return process.env.NEXT_PUBLIC_LOCALNET_RPC_URL || "http://127.0.0.1:8901";
  }
  return process.env.NEXT_PUBLIC_DEVNET_RPC_URL || "https://api.devnet.solana.com";
}
