# wrap-stablecoin-mono

Monorepo for the Kamino-backed wrap program ([`wrap-stablecoin/`](wrap-stablecoin/)), a Rust API that builds unsigned transactions, and Next.js public + admin frontends.

**Wiki:** [`wiki/Home.md`](wiki/Home.md) — architecture, monorepo layout, API, and frontend docs.

## Prerequisites

- Rust toolchain, `cargo`
- Anchor (for building [`programs/wrap-stablecoin`](wrap-stablecoin/programs/wrap-stablecoin))
- Node 20+ and **pnpm**

## On-chain program

```bash
cd wrap-stablecoin
anchor build
anchor run local   # persistent localnet + KLend — see wiki/Local-development.md
```

IDL output: `wrap-stablecoin/target/idl/wrap_stablecoin.json`.

## Backend (Axum + utoipa + Solana)

```bash
cd backend
cp .env.example .env
# Single network: SOLANA_* + PUBLIC_SOLANA_* + PROGRAM_ID + VAULT_AUTHORITY
cargo run
```

- **Swagger UI:** [http://127.0.0.1:8080/doc](http://127.0.0.1:8080/doc) (default port `8080`, override with `BIND_PORT`).
- **Bootstrap:** `GET /v1/client-config` — public deployment config for frontends.
- **Endpoints:** `GET /ping`, `POST /v1/tx/issue`, `POST /v1/tx/redeem`, `POST /v1/tx/preview`, `POST /v1/tx/compose` (Jupiter + wrap/unwrap; see OpenAPI).

## Frontend (Next.js 16 + MUI + Solana wallet adapter)

```bash
cd frontend
# .env.local: NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080
pnpm install
pnpm run dev
```

App runs at [http://localhost:3001](http://localhost:3001). Admin console: [`admin-frontend/`](admin-frontend/) on port **3002** (same backend URL env).

Cluster / RPC / program / mint config is **not** set in the Next apps — it is loaded from the backend at bootstrap.

## Environment summary

| Area | Variable | Purpose |
|------|----------|---------|
| Backend | `SOLANA_RPC_URL` | Internal RPC URL |
| Backend | `SOLANA_NETWORK` | `localnet` / `devnet` / `mainnet` |
| Backend | `PROGRAM_ID` | `wrap_stablecoin` program id |
| Backend | `VAULT_AUTHORITY` | Seeds `vault_config` PDA |
| Backend | `PUBLIC_SOLANA_RPC_URL` | Browser-safe RPC (client-config) |
| Backend | `PUBLIC_SOLANA_WS_URL` | Browser-safe WS (client-config) |
| Frontend / admin | `NEXT_PUBLIC_BACKEND_URL` | Backend origin (sole public deployment env) |

Static check: `./scripts/check_frontend_env.sh`
