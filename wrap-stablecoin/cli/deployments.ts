/**
 * Per-cluster deploy artifact: deployments/<network>.json.
 *
 * Single source of truth for everything downstream — `cli sync-env` renders
 * backend/.env and the frontend .env.local files from it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Network, REPO_ROOT } from "./network";

export type DeployedAsset = {
  mint: string;
  assetConfig: string;
  tokenVault: string;
  treasuryVault: string;
  /** Present once Kamino is enabled for this asset. */
  klendConfig?: string;
  collateralVault?: string;
  reserve?: string;
  lendingMarket?: string;
};

export type Deployment = {
  cluster: Network;
  rpcUrl: string;
  wsUrl: string;
  backendUrl: string;
  programId: string;
  /** Admin pubkey that seeds vault_config (backend `VAULT_AUTHORITY`). */
  authority: string;
  vaultConfig: string;
  /** The vault_authority PDA that signs token operations. */
  vaultAuthority: string;
  wrappedMint: string;
  defaultAssetMint: string;
  /** Registered collateral, keyed by underlying mint. */
  assets: Record<string, DeployedAsset>;
  /** Localnet-only test mints seeded for manual UI work. */
  dummyMints?: Record<string, string>;
};

/**
 * Fields `cli sync-env` renders straight into env files. A missing one would be
 * written as the literal string "undefined", so reject the artifact instead.
 */
const REQUIRED_FIELDS: (keyof Deployment)[] = [
  "cluster",
  "rpcUrl",
  "wsUrl",
  "backendUrl",
  "programId",
  "authority",
  "defaultAssetMint",
];

export const DEPLOYMENTS_DIR = path.join(REPO_ROOT, "deployments");

export function deploymentPath(network: Network): string {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

export function readDeployment(network: Network): Deployment {
  const file = deploymentPath(network);
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${relative(file)} — run \`pnpm cli init --network ${network}\``);
  }
  const dep = JSON.parse(fs.readFileSync(file, "utf8")) as Deployment;
  const missing = REQUIRED_FIELDS.filter((field) => !dep[field]);
  if (missing.length > 0) {
    throw new Error(
      `invalid ${relative(file)}: missing ${missing.join(", ")} — delete it and re-run ` +
        `\`pnpm cli init --network ${network}\``,
    );
  }
  if (!dep.assets) dep.assets = {};
  return dep;
}

export function readDeploymentIfPresent(network: Network): Deployment | undefined {
  return fs.existsSync(deploymentPath(network)) ? readDeployment(network) : undefined;
}

/** Merge into the existing artifact so re-running init keeps earlier assets. */
export function writeDeployment(update: Deployment): Deployment {
  const existing = readDeploymentIfPresent(update.cluster);
  const merged: Deployment = {
    ...existing,
    ...update,
    assets: { ...existing?.assets, ...update.assets },
    dummyMints: { ...existing?.dummyMints, ...update.dummyMints },
  };
  if (Object.keys(merged.dummyMints ?? {}).length === 0) delete merged.dummyMints;

  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  fs.writeFileSync(deploymentPath(update.cluster), JSON.stringify(merged, null, 2) + "\n");
  return merged;
}

export function relative(file: string): string {
  return path.relative(REPO_ROOT, file);
}
