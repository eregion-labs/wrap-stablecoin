/**
 * Render backend/.env and the frontend .env.local files from
 * deployments/<network>.json.
 *
 * Merge rule for backend/.env: managed keys are rewritten, unrelated keys
 * (ADMIN_KEYPAIR_PATH, SECRET_NAME, ...) are preserved.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Deployment, readDeployment, relative } from "../deployments";
import { Network, NETWORKS, REPO_ROOT, wsUrl } from "../network";

const BACKEND_ENV = path.join(REPO_ROOT, "backend/.env");
const FRONTEND_ENV_LOCAL = path.join(REPO_ROOT, "frontend/.env.local");
const ADMIN_ENV_LOCAL = path.join(REPO_ROOT, "admin-frontend/.env.local");

const MANAGED_KEYS = [
  "APP_ENV",
  "SOLANA_RPC_URL",
  "SOLANA_NETWORK",
  "PROGRAM_ID",
  "VAULT_AUTHORITY",
  "DEFAULT_ASSET_MINT",
  "CLIENT_SOLANA_RPC_URL",
  "CLIENT_SOLANA_WS_URL",
] as const;

/**
 * Keys earlier generations wrote that the backend no longer reads: the removed
 * PUBLIC_SOLANA_* aliases of CLIENT_SOLANA_*, and addresses the backend derives
 * from PROGRAM_ID + VAULT_AUTHORITY. Dropped on every regeneration.
 */
const RETIRED_KEYS = [
  "PUBLIC_SOLANA_RPC_URL",
  "PUBLIC_SOLANA_WS_URL",
  "WRAPPED_MINT",
  "VAULT_CONFIG",
];

/** backend/src/config/public_client_config.rs AppEnvironment. */
const APP_ENV: Record<Network, string> = {
  localnet: "local",
  devnet: "development",
  mainnet: "production",
};

/**
 * Single-line KEY=VALUE only. Anything this cannot round-trip (a line without a
 * key, a multi-line quoted value) is rejected rather than silently rewritten.
 */
function parseEnvFile(file: string, content: string): Map<string, string> {
  const env = new Map<string, string>();
  content.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const at = `${relative(file)}:${index + 1}`;
    const eq = trimmed.indexOf("=");
    const key = eq < 0 ? "" : trimmed.slice(0, eq).trim();
    if (!key) {
      throw new Error(`${at}: expected KEY=VALUE, got \`${trimmed}\``);
    }
    const value = trimmed.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === `"` || quote === "'") && (value.length < 2 || !value.endsWith(quote))) {
      throw new Error(`${at}: ${key} has an unclosed ${quote} (multi-line values are not supported)`);
    }
    env.set(key, value);
  });
  return env;
}

function formatEnvFile(env: Map<string, string>, header: string): string {
  const managed = new Set<string>(MANAGED_KEYS);
  const lines = [header, ""];
  for (const key of MANAGED_KEYS) {
    if (env.has(key)) lines.push(`${key}=${env.get(key)}`);
  }
  const extras = [...env]
    .filter(([key]) => !managed.has(key))
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  if (extras.length > 0) {
    lines.push("", "# Preserved local overrides", ...extras);
  }
  lines.push("");
  return lines.join("\n");
}

function writeFile(file: string, body: string, dryRun: boolean): void {
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  console.log(`  ${relative(file)}`);
}

function renderBackendEnv(dep: Deployment, existing: Map<string, string>): Map<string, string> {
  const env = new Map(existing);
  for (const key of RETIRED_KEYS) env.delete(key);
  // backend/src/config/env.rs resolves `{KEY}_{NETWORK}` before the bare key, so a
  // leftover scoped override would silently win over the value written just below.
  for (const key of MANAGED_KEYS) {
    for (const network of NETWORKS) env.delete(`${key}_${network.toUpperCase()}`);
  }

  const updates: Record<string, string> = {
    APP_ENV: APP_ENV[dep.cluster],
    SOLANA_RPC_URL: dep.rpcUrl,
    SOLANA_NETWORK: dep.cluster,
    PROGRAM_ID: dep.programId,
    VAULT_AUTHORITY: dep.authority,
    DEFAULT_ASSET_MINT: dep.defaultAssetMint,
    CLIENT_SOLANA_RPC_URL: dep.clientRpcUrl,
    CLIENT_SOLANA_WS_URL: wsUrl(dep.clientRpcUrl),
  };
  for (const [key, value] of Object.entries(updates)) env.set(key, value);

  // Operator-owned keys: seed a working default, never overwrite.
  // /v1/admin/* is unauthenticated, so a hosted cluster stays on loopback.
  if (!env.get("BIND_HOST")) {
    env.set("BIND_HOST", dep.cluster === "localnet" ? "0.0.0.0" : "127.0.0.1");
  }
  if (!env.get("BIND_PORT")) env.set("BIND_PORT", "8080");
  if (dep.cluster === "localnet" && !env.get("ADMIN_KEYPAIR_PATH")) {
    env.set("ADMIN_KEYPAIR_PATH", ".secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json");
  }
  // DEPLOYMENT_ID is required by the backend whenever APP_ENV is not local.
  if (dep.cluster !== "localnet" && !env.get("DEPLOYMENT_ID")) {
    env.set("DEPLOYMENT_ID", `${dep.cluster}-1`);
  }
  return env;
}

export function syncEnv(dep: Deployment, dryRun = false): void {
  const existing = fs.existsSync(BACKEND_ENV)
    ? parseEnvFile(BACKEND_ENV, fs.readFileSync(BACKEND_ENV, "utf8"))
    : new Map<string, string>();
  const env = renderBackendEnv(dep, existing);

  console.log(dryRun ? "─── Env files (dry-run) ───" : "─── Env files synced ───");
  writeFile(
    BACKEND_ENV,
    formatEnvFile(
      env,
      `# Generated by \`pnpm cli sync-env --network ${dep.cluster}\` from ${dep.cluster}.json.\n# Unrelated keys below are preserved across regenerations; comments are not.`,
    ),
    dryRun,
  );

  const frontendBody =
    "# Sole public deployment env — all other config from GET /v1/client-config\n" +
    `NEXT_PUBLIC_BACKEND_URL=${dep.backendUrl}\n`;
  writeFile(FRONTEND_ENV_LOCAL, frontendBody, dryRun);
  writeFile(ADMIN_ENV_LOCAL, frontendBody, dryRun);
  console.log("────────────────────────");
}

export function syncEnvCommand(network: Network, dryRun: boolean): void {
  syncEnv(readDeployment(network), dryRun);
}
