# Monorepo

The repository contains three cooperating packages.

## Layout

```
wrap-stablecoin/          # Anchor workspace (on-chain program + tests)
  programs/wrap-stablecoin/ # Rust Anchor program
  tests/                  # TypeScript integration tests
  ARCHITECTURE.md         # Canonical on-chain design doc

backend/                  # Axum API (unsigned tx builder)
frontend/                 # Next.js wallet UI
wiki/                     # This wiki
```

## Prerequisites

- Rust toolchain, `cargo`
- Anchor (for `wrap-stablecoin/programs/wrap-stablecoin`)
- Node 20+ and npm

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
cargo run
```

- Swagger UI: http://127.0.0.1:8080/doc (default port `8080`, override with `BIND_PORT`).

## Frontend

```bash
cd frontend
# Create .env.local with NEXT_PUBLIC_API_BASE
npm install
npm run dev
```

App runs at http://localhost:3001 by default.

## Environment variables

| Area | Variable | Purpose |
|------|----------|---------|
| Backend | `SOLANA_RPC_URL` | RPC URL |
| Backend | `PROGRAM_ID` | `wrap_stablecoin` program id |
| Backend | `VAULT_AUTHORITY` | Pubkey that seeds `vault_config` PDA |
| Frontend | `NEXT_PUBLIC_API_BASE` | Backend origin (no trailing slash) |
| Frontend | `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` / `mainnet` / `localnet` |
