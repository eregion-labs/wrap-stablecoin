# Monorepo

The repository contains cooperating packages.

## Layout

```
wrap-stablecoin/          # Anchor workspace (on-chain program + tests)
  programs/wrap-stablecoin/ # Rust Anchor program
  tests/                  # TypeScript integration tests
  ARCHITECTURE.md         # Canonical on-chain design doc

backend/                  # Axum API (unsigned tx builder + public client-config)
frontend/                 # Next.js wallet UI
admin-frontend/           # Next.js operator console (backend-signed admin txs)
shared/client-config/     # Shared Zod schema for GET /v1/client-config
deployments/              # Per-cluster deploy artifacts written by `cli init`
wiki/                     # This wiki
```

## Prerequisites

- Rust toolchain, `cargo`
- Anchor (for `wrap-stablecoin/programs/wrap-stablecoin`)
- Node 20+ and **pnpm** (`minimumReleaseAge: 1440` preferred for new installs)

## Env ownership (backend SSOT)

```text
Operator / anchor run local
        │
        ▼
backend/.env  (+ optional SECRET_NAME AWS SM fill-missing)
        │
        ▼
GET /v1/client-config   ← frozen PublicClientConfig
        │
        ▼
frontend / admin  (NEXT_PUBLIC_BACKEND_URL only)
```

One backend process = one Solana cluster. Frontends do not switch networks.

## On-chain program

```bash
cd wrap-stablecoin
anchor build
anchor run local   # also syncs backend + frontend env files
```

IDL build output lands in `wrap-stablecoin/target/`, which is gitignored, so a fresh checkout has no IDL until something builds. The **committed** copy under `wrap-stablecoin/idl/` removes that dependency for the consumers that read the IDL directly:

- `scripts/devnet-e2e/40_flow_test.ts` `require()`s `idl/wrap_stablecoin.json` at runtime, so it runs against a fresh checkout with no build.
- `cli/` reads the same file for both the runtime `Program` and the program id (`cli/network.ts`), so every CLI command — and `20_seed_vault.ts` and `seed_localnet.ts`, which call `cli init` — works with no build. `scripts/local_env.sh` reads it too, so the localnet validator loads the program at `declare_id!` rather than at whatever keypair `anchor build` last wrote.
- The mocha tests and `scripts/backend_smoke.ts` import only the `WrapStablecoin` **type** from `idl/wrap_stablecoin.ts`. Their runtime `Program` still comes from `anchor.workspace.wrapStablecoin`, which Anchor resolves to `target/idl/`, so those still need `anchor build` first.

After any change to program accounts, instructions or errors, regenerate the tracked copy and commit it:

```bash
cd wrap-stablecoin
anchor idl build -o idl/wrap_stablecoin.json -t idl/wrap_stablecoin.ts
```

The tracked files are generated output, never hand-edited, so they are byte-identical to what a build produces and `cmp` against `target/` is the drift check. `scripts/verify_branding_release.sh` runs it on both artifacts. (The `.ts` header comment points at `target/idl/wrap_stablecoin.json` because Anchor writes it that way; the authoritative copy is the tracked one next to it.)

Destinations are recorded in `wrap-stablecoin/.idl-sync.json`. Because nothing is edited after generation, copying `target/idl/wrap_stablecoin.json` and `target/types/wrap_stablecoin.ts` into `idl/` is equivalent to the command above.

## Backend

```bash
cd backend
# Prefer env written by `anchor run local`; or `cp .env.example .env`
cargo run
```

- Swagger UI: http://127.0.0.1:8080/doc (default port `8080`, override with `BIND_PORT`).
- Public bootstrap: `GET /v1/client-config`
- Boot: `.env` → optional `SECRET_NAME` (AWS CLI) fill-missing-only

## Frontend / admin

```bash
cd frontend   # or admin-frontend
cp .env.example .env.local   # or rely on anchor run local
pnpm install
pnpm run dev
```

- Public app: http://localhost:3001
- Admin: http://localhost:3002

## Environment variables

| Area | Variable | Purpose |
|------|----------|---------|
| Backend | `APP_ENV` | `local` / `development` / `staging` / `production` |
| Backend | `DEPLOYMENT_ID` | Required when `APP_ENV` ≠ `local` |
| Backend | `SOLANA_RPC_URL` | Internal RPC (workers / tx build) |
| Backend | `SOLANA_NETWORK` | `localnet` / `devnet` / `mainnet` |
| Backend | `PROGRAM_ID` | `wrap_stablecoin` program id (or `PROGRAM_ID_{NETWORK}`) |
| Backend | `VAULT_AUTHORITY` | Pubkey that seeds `vault_config` PDA |
| Backend | `DEFAULT_ASSET_MINT` | Required; network-scoped override supported |
| Backend | `CLIENT_SOLANA_RPC_URL` | Browser-safe RPC (alias `PUBLIC_SOLANA_RPC_URL`) |
| Backend | `CLIENT_SOLANA_WS_URL` | Browser-safe WS (alias `PUBLIC_SOLANA_WS_URL`) |
| Backend | `EXPLORER_BASE_URL` | Explorer base in client-config (default Solscan) |
| Backend | `SECRET_NAME` | Optional AWS SM flat JSON |
| Backend | `ADMIN_KEYPAIR_PATH` | Optional admin signer for `/v1/admin/*` |
| Backend | `ADMIN_DASHBOARD_URL` | Optional link in client-config |
| Frontend / admin | `NEXT_PUBLIC_BACKEND_URL` | **Only** public deployment env — points at one API |

RPC endpoints, program ids, and default asset mint are **not** set in the Next apps; they come from `/v1/client-config`.

Static check: `./scripts/check_frontend_env.sh`
