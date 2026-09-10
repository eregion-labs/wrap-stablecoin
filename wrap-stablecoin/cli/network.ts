/**
 * Cluster resolution for the CLI: network name -> RPC, wallet, program id.
 *
 * Env keys follow the backend convention (backend/src/config/env.rs):
 *   {KEY}_{LOCALNET|DEVNET|MAINNET} -> {KEY}
 * except on mainnet, which never reads the unscoped key (see envForNetwork).
 *
 * The program id always comes from the tracked IDL, i.e. `declare_id!` — the same
 * value Anchor.toml carries and the cluster already runs. The deploy keypair is
 * only checked against it (see commands/deploy.ts), never trusted over it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";

export const NETWORKS = ["localnet", "devnet", "mainnet"] as const;
export type Network = (typeof NETWORKS)[number];

export const PACKAGE_ROOT = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..");

/** Tracked, so the CLI resolves the program id without a build. */
const PROGRAM_IDL = path.join(PACKAGE_ROOT, "idl/wrap_stablecoin.json");
const PROGRAM_KEYPAIR = path.join(
  PACKAGE_ROOT,
  "target/deploy/wrap_stablecoin-keypair.json",
);
/** Fixture admin used by the localnet validator and the devnet e2e market. */
const FIXTURE_WALLET = ".secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json";
/** Fixture deployer — pays for the program account, holds upgrade authority. */
const FIXTURE_DEPLOYER = ".secrets/depxPDoQBS9JXgwVumiJeuaaSU9b8FaCRwEVTaGD1v9.json";
const DEVNET_RPC = "https://api.devnet.solana.com";
const DEFAULT_LOCAL_RPC_PORT = 8901;

export type NetworkContext = {
  network: Network;
  rpcUrl: string;
  wsUrl: string;
  walletPath: string;
  authority: Keypair;
  programId: PublicKey;
};

export function parseNetwork(value: string | undefined): Network {
  if (!value) {
    throw new Error(`--network is required (${NETWORKS.join(" | ")})`);
  }
  const network = NETWORKS.find((n) => n === value);
  if (!network) {
    throw new Error(`unknown network "${value}" (${NETWORKS.join(" | ")})`);
  }
  return network;
}

/**
 * Mainnet reads only its own scoped key: an unscoped ANCHOR_WALLET or RPC_URL is
 * whatever the last localnet/devnet shell exported — `anchor` itself sets
 * ANCHOR_WALLET to the fixture admin — and must never become a mainnet default.
 */
function envForNetwork(key: string, network: Network): string | undefined {
  const scoped = process.env[`${key}_${network.toUpperCase()}`]?.trim();
  if (network === "mainnet") return scoped || undefined;
  return scoped || process.env[key]?.trim() || undefined;
}

export function loadKeypair(file: string): Keypair {
  if (!fs.existsSync(file)) {
    throw new Error(`keypair not found: ${file}`);
  }
  const secret = JSON.parse(fs.readFileSync(file, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

/** The committed IDL; `address` is `declare_id!`. See wiki/Monorepo.md. */
export function readIdl(): Record<string, any> {
  if (!fs.existsSync(PROGRAM_IDL)) {
    throw new Error(`missing ${PROGRAM_IDL} — regenerate it with anchor idl build`);
  }
  return JSON.parse(fs.readFileSync(PROGRAM_IDL, "utf8"));
}

/** Program id from `declare_id!`, via the committed IDL. */
export function programId(): PublicKey {
  const address = readIdl().address as string | undefined;
  if (!address) throw new Error(`${PROGRAM_IDL} has no address field`);
  return new PublicKey(address);
}

/**
 * Pubkey of the keypair `anchor deploy` would publish under. A mismatch with
 * declare_id! means the local keypair is stale — deploying would land the
 * program at a different address than every PDA is derived from.
 */
export function deployKeypairId(): PublicKey | undefined {
  return fs.existsSync(PROGRAM_KEYPAIR) ? loadKeypair(PROGRAM_KEYPAIR).publicKey : undefined;
}

export function rpcUrl(network: Network): string {
  const explicit = envForNetwork("RPC_URL", network);
  if (explicit) return explicit;
  switch (network) {
    case "localnet": {
      // How `anchor run local` hands the seed script its validator URL. Never
      // consulted for a hosted cluster: it carries no network of its own, so
      // honouring it there would silently redirect a devnet/mainnet command.
      const anchorUrl = process.env.ANCHOR_PROVIDER_URL?.trim();
      if (anchorUrl) return anchorUrl;
      const port = Number(process.env.RPC_PORT ?? DEFAULT_LOCAL_RPC_PORT);
      return `http://127.0.0.1:${port}`;
    }
    case "devnet":
      return DEVNET_RPC;
    case "mainnet":
      throw new Error(
        "mainnet needs an explicit RPC: set RPC_URL_MAINNET (public endpoints cannot serve deploys)",
      );
  }
}

/** Local validator serves WS on RPC_PORT - 1; hosted RPCs use the same host. */
export function wsUrl(rpc: string): string {
  const url = new URL(rpc);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    const port = Number(url.port || DEFAULT_LOCAL_RPC_PORT);
    return `ws://${url.hostname}:${port - 1}`;
  }
  return rpc.replace(/^http/, "ws");
}

function resolveWallet(network: Network, key: string, fixture: string): string {
  const explicit = envForNetwork(key, network);
  if (explicit) return path.resolve(PACKAGE_ROOT, explicit);
  if (network === "mainnet") {
    throw new Error(
      `mainnet needs an explicit signer: set ${key}_MAINNET (fixture keypairs are never used on mainnet)`,
    );
  }
  return path.join(PACKAGE_ROOT, fixture);
}

/** Vault admin: signs initialize, add_asset, enable_klend, metadata. */
export function walletPath(network: Network): string {
  return resolveWallet(network, "ANCHOR_WALLET", FIXTURE_WALLET);
}

/**
 * Program deployer, kept separate from the vault admin: it funds the program
 * account and becomes its upgrade authority.
 */
export function deployerWalletPath(network: Network): string {
  return resolveWallet(network, "DEPLOYER_WALLET", FIXTURE_DEPLOYER);
}

export function resolveNetwork(network: Network): NetworkContext {
  const rpc = rpcUrl(network);
  const wallet = walletPath(network);
  return {
    network,
    rpcUrl: rpc,
    wsUrl: wsUrl(rpc),
    walletPath: wallet,
    authority: loadKeypair(wallet),
    programId: programId(),
  };
}
