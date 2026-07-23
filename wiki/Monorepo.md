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
wiki/                     # This wiki
```

## Prerequisites

- Rust toolchain, `cargo`
- Anchor (for `wrap-stablecoin/programs/wrap-stablecoin`)
- Node 20+ and **pnpm** (`minimumReleaseAge: 1440` preferred for new installs)

## On-chain program

```bash
cd wrap-stablecoin
anchor build
```

IDL output: `wrap-stablecoin/target/idl/wrap_stablecoin.json`.

## Backend

```bash
cd backend
cp .env.example .env
# Set SOLANA_* + PUBLIC_SOLANA_* + PROGRAM_ID + VAULT_AUTHORITY (single network)
cargo run
```

- Swagger UI: http://127.0.0.1:8080/doc (default port `8080`, override with `BIND_PORT`).
- Public bootstrap: `GET /v1/client-config`

## Frontend / admin

```bash
cd frontend   # or admin-frontend
# .env.local: NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080
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
| Backend | `PROGRAM_ID` | `wrap_stablecoin` program id |
| Backend | `VAULT_AUTHORITY` | Pubkey that seeds `vault_config` PDA |
| Backend | `PUBLIC_SOLANA_RPC_URL` | Browser-safe RPC (in client-config) |
| Backend | `PUBLIC_SOLANA_WS_URL` | Browser-safe WS (in client-config) |
| Backend | `ADMIN_KEYPAIR_PATH` | Optional admin signer for `/v1/admin/*` |
| Backend | `ADMIN_DASHBOARD_URL` | Optional link in client-config |
| Frontend / admin | `NEXT_PUBLIC_BACKEND_URL` | **Only** public deployment env — points at one API |

RPC endpoints, program ids, and default asset mint are **not** set in the Next apps; they come from `/v1/client-config`.

Static check: `./scripts/check_frontend_env.sh`
