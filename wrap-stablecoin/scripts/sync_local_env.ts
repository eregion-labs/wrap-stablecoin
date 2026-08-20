/**
 * Merge localnet seed outputs into backend/.env and frontend .env.local files.
 * Invoked by seed_localnet.ts after vault bootstrap (also usable standalone with
 * deployments/localnet.json).
 *
 * Merge rule for backend/.env: update managed keys; preserve unrelated keys
 * (e.g. ADMIN_KEYPAIR_PATH, SECRET_NAME).
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const BACKEND_ENV = path.join(REPO_ROOT, "backend/.env");
const FRONTEND_ENV_LOCAL = path.join(REPO_ROOT, "frontend/.env.local");
const ADMIN_ENV_LOCAL = path.join(REPO_ROOT, "admin-frontend/.env.local");
const DEPLOYMENTS_DIR = path.join(REPO_ROOT, "deployments");
const LOCALNET_JSON = path.join(DEPLOYMENTS_DIR, "localnet.json");

export type LocalnetDeployment = {
  cluster: "localnet";
  rpcUrl: string;
  wsUrl: string;
  backendUrl: string;
  programId: string;
  vaultAuthority: string;
  defaultAssetMint: string;
  wrappedMint: string;
  vaultConfig: string;
  assetConfig: string;
  klendConfig: string;
  tokenVault: string;
  treasuryVault: string;
  collateralVault: string;
  cccMint?: string;
  tttMint?: string;
};

const BACKEND_MANAGED_KEYS = [
  "APP_ENV",
  "SOLANA_RPC_URL",
  "SOLANA_NETWORK",
  "PROGRAM_ID",
  "VAULT_AUTHORITY",
  "DEFAULT_ASSET_MINT",
  "CLIENT_SOLANA_RPC_URL",
  "CLIENT_SOLANA_WS_URL",
  // Legacy aliases kept in sync for older docs/scripts
  "PUBLIC_SOLANA_RPC_URL",
  "PUBLIC_SOLANA_WS_URL",
  "WRAPPED_MINT",
  "VAULT_CONFIG",
] as const;

function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(key, value);
  }
  return map;
}

function formatEnvFile(
  existing: Map<string, string>,
  updates: Record<string, string>,
  headerComment: string,
): string {
  const managed = new Set<string>(BACKEND_MANAGED_KEYS as unknown as string[]);
  for (const [k, v] of Object.entries(updates)) {
    existing.set(k, v);
  }

  const lines: string[] = [headerComment, ""];
  const written = new Set<string>();

  // Write managed keys first in stable order
  for (const key of BACKEND_MANAGED_KEYS) {
    if (existing.has(key)) {
      lines.push(`${key}=${existing.get(key)}`);
      written.add(key);
    }
  }

  // Preserve unrelated keys
  const extras: string[] = [];
  for (const [key, value] of existing) {
    if (written.has(key) || managed.has(key)) continue;
    extras.push(`${key}=${value}`);
  }
  if (extras.length > 0) {
    lines.push("");
    lines.push("# Preserved local overrides");
    lines.push(...extras.sort());
  }

  lines.push("");
  return lines.join("\n");
}

export function writeDeploymentArtifact(dep: LocalnetDeployment): void {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  fs.writeFileSync(LOCALNET_JSON, JSON.stringify(dep, null, 2) + "\n");
}

export function syncLocalEnv(dep: LocalnetDeployment): void {
  writeDeploymentArtifact(dep);

  const backendUpdates: Record<string, string> = {
    APP_ENV: "local",
    SOLANA_RPC_URL: dep.rpcUrl,
    SOLANA_NETWORK: "localnet",
    PROGRAM_ID: dep.programId,
    VAULT_AUTHORITY: dep.vaultAuthority,
    DEFAULT_ASSET_MINT: dep.defaultAssetMint,
    CLIENT_SOLANA_RPC_URL: dep.rpcUrl,
    CLIENT_SOLANA_WS_URL: dep.wsUrl,
    PUBLIC_SOLANA_RPC_URL: dep.rpcUrl,
    PUBLIC_SOLANA_WS_URL: dep.wsUrl,
    WRAPPED_MINT: dep.wrappedMint,
    VAULT_CONFIG: dep.vaultConfig,
  };

  const existing = fs.existsSync(BACKEND_ENV)
    ? parseEnvFile(fs.readFileSync(BACKEND_ENV, "utf8"))
    : new Map<string, string>();

  // Sensible default for local admin signer if unset
  if (!existing.has("ADMIN_KEYPAIR_PATH") || !existing.get("ADMIN_KEYPAIR_PATH")) {
    existing.set(
      "ADMIN_KEYPAIR_PATH",
      ".secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json",
    );
  }
  // The backend refuses to boot with an admin signer and no bearer token, so mint a random
  // one for localnet. Generated per machine and preserved across regenerations; never
  // reuse a localnet token in a deployed environment.
  if (!existing.has("ADMIN_API_TOKEN") || !existing.get("ADMIN_API_TOKEN")) {
    existing.set("ADMIN_API_TOKEN", crypto.randomBytes(32).toString("base64url"));
  }
  const adminApiToken = existing.get("ADMIN_API_TOKEN") as string;
  if (!existing.has("BIND_HOST")) existing.set("BIND_HOST", "0.0.0.0");
  if (!existing.has("BIND_PORT")) existing.set("BIND_PORT", "8080");

  const backendBody = formatEnvFile(
    existing,
    backendUpdates,
    "# Generated/updated by wrap-stablecoin/scripts/sync_local_env.ts (anchor run local).\n# Unrelated keys below are preserved across regenerations.",
  );
  fs.mkdirSync(path.dirname(BACKEND_ENV), { recursive: true });
  fs.writeFileSync(BACKEND_ENV, backendBody);

  const frontendBody =
    "# Sole public deployment env — all other config from GET /v1/client-config\n" +
    `NEXT_PUBLIC_BACKEND_URL=${dep.backendUrl}\n`;
  fs.mkdirSync(path.dirname(FRONTEND_ENV_LOCAL), { recursive: true });
  fs.writeFileSync(FRONTEND_ENV_LOCAL, frontendBody);

  // The admin console additionally carries the bearer token for /v1/admin/*.
  const adminBody = frontendBody + `NEXT_PUBLIC_ADMIN_API_TOKEN=${adminApiToken}\n`;
  fs.mkdirSync(path.dirname(ADMIN_ENV_LOCAL), { recursive: true });
  fs.writeFileSync(ADMIN_ENV_LOCAL, adminBody);

  console.log("");
  console.log("─── Env files synced ───");
  console.log(`  ${path.relative(REPO_ROOT, BACKEND_ENV)}`);
  console.log(`  ${path.relative(REPO_ROOT, FRONTEND_ENV_LOCAL)}`);
  console.log(`  ${path.relative(REPO_ROOT, ADMIN_ENV_LOCAL)}`);
  console.log(`  ${path.relative(REPO_ROOT, LOCALNET_JSON)}`);
  console.log(`NEXT_PUBLIC_BACKEND_URL=${dep.backendUrl}`);
  console.log("────────────────────────");
}

function deriveWsUrl(rpcUrl: string): string {
  try {
    const u = new URL(rpcUrl);
    const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
    // Local validator: RPC_PORT, WS is typically RPC_PORT - 1 (8901 → 8900).
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      return `ws://${u.hostname}:${port - 1}`;
    }
  } catch {
    /* fall through */
  }
  return rpcUrl.replace(/^http/, "ws");
}

/** CLI: yarn ts-node scripts/sync_local_env.ts [path/to/localnet.json] */
function main(): void {
  const arg = process.argv[2];
  const jsonPath = arg
    ? path.resolve(arg)
    : LOCALNET_JSON;
  if (!fs.existsSync(jsonPath)) {
    console.error(
      `missing ${jsonPath} — run seed_localnet first or pass a deployment JSON path`,
    );
    process.exit(1);
  }
  const dep = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as LocalnetDeployment;
  if (!dep.rpcUrl || !dep.programId) {
    console.error("invalid deployment JSON: need rpcUrl + programId");
    process.exit(1);
  }
  if (!dep.wsUrl) dep.wsUrl = deriveWsUrl(dep.rpcUrl);
  if (!dep.backendUrl) dep.backendUrl = "http://127.0.0.1:8080";
  syncLocalEnv(dep);
}

if (require.main === module) {
  main();
}
