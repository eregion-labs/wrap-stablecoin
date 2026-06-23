# wrap-stablecoin-mono

Monorepo for the Kamino-backed wrap program ([`wrap-stablecoin/`](wrap-stablecoin/)), a Rust API that builds unsigned transactions, and a Next.js frontend with direct Solana wallet connection.

**Wiki:** [`wiki/Home.md`](wiki/Home.md) — architecture, monorepo layout, API, and frontend docs.

## Prerequisites

- Rust toolchain, `cargo`
- Anchor (for building [`programs/wrap-stablecoin`](wrap-stablecoin/programs/wrap-stablecoin))
- Node 20+ and npm

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
# Set VAULT_AUTHORITY to the pubkey that seeds vault_config (see program docs).
cargo run
```

- **Swagger UI:** [http://127.0.0.1:8080/doc](http://127.0.0.1:8080/doc) (default port `8080`, override with `BIND_PORT`).
- **Endpoints:** `GET /ping`, `POST /v1/tx/issue`, `POST /v1/tx/redeem`, `POST /v1/tx/preview`, `POST /v1/tx/compose` (Jupiter + wrap/unwrap; see OpenAPI).

## Frontend (Next.js 16 + MUI + Solana wallet adapter)

```bash
cd frontend
# Create .env.local with NEXT_PUBLIC_API_BASE (backend origin, no trailing slash).
npm install
npm run dev
```

App runs at [http://localhost:3001](http://localhost:3001) by default.

### Optional: GraphQL codegen (Witan parity)

GraphQL client codegen was omitted to keep installs smaller. To add a GraphQL admin client, add `@graphql-codegen/cli`, `graphql`, a `schema.graphql`, and a `codegen.ts` script.

## Environment summary

| Area | Variable | Purpose |
|------|----------|---------|
| Backend | `SOLANA_RPC_URL` | RPC URL |
| Backend | `PROGRAM_ID` | `wrap_stablecoin` program id |
| Backend | `VAULT_AUTHORITY` | Seeds `vault_config` PDA |
| Frontend | `NEXT_PUBLIC_API_BASE` | Backend origin (no trailing slash) |
| Frontend | `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` / `mainnet` / `localnet` |
