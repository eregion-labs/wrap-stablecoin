# Backend API

Rust service (Axum + utoipa + Solana SDK) that builds **unsigned** transactions for wrap/unwrap and optional Jupiter composition.

Source: `backend/src/`

One process serves **exactly one** Solana network. Frontends discover public deployment config via REST bootstrap (not GraphQL).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ping` | Health check (`network`, `deploymentId`) |
| `GET` | `/v1/client-config` | Immutable public bootstrap config (schemaVersion 1) |
| `GET` | `/v1/vault/assets` | Per-asset vault balances and policy |
| `GET` | `/v1/vault/meta` | Vault admin, wrapped mint, Metaplex metadata |
| `GET` | `/v1/vault/token-holders` | Largest FLRN token accounts (RPC top 20; keys are token accounts) |
| `GET` | `/v1/quote/redeem` | Expected unwrap output and free liquidity |
| `POST` | `/v1/tx/issue` | Unsigned wrap transaction |
| `POST` | `/v1/tx/redeem` | Unsigned unwrap transaction |
| `POST` | `/v1/tx/preview` | Simulate a transaction |
| `POST` | `/v1/tx/compose` | Multi-step Jupiter + wrap/unwrap bundle |

OpenAPI / Swagger: `/doc`

## Client config (bootstrap)

`GET /v1/client-config` is unauthenticated and returns camelCase JSON, e.g.:

```json
{
  "schemaVersion": 1,
  "deploymentId": "local-dev",
  "environment": "local",
  "solana": {
    "network": "localnet",
    "rpcUrl": "http://127.0.0.1:8901",
    "wsUrl": "ws://127.0.0.1:8900",
    "programIds": { "wrapStablecoin": "..." }
  },
  "assets": { "defaultAssetMint": "..." },
  "features": {
    "capabilities": { "jupiterCompose": true, "adminDashboard": true }
  },
  "links": {
    "adminDashboardUrl": "http://localhost:3002",
    "explorerBaseUrl": "https://solscan.io"
  }
}
```

Caching: `Cache-Control: public, max-age=60, stale-while-revalidate=300` + `ETag`.

Never includes secrets (admin keypairs, internal privileged RPC credentials).

Backend builds this from `CLIENT_SOLANA_RPC_URL` / `CLIENT_SOLANA_WS_URL` (legacy aliases `PUBLIC_SOLANA_*` accepted), `PROGRAM_ID`, `DEFAULT_ASSET_MINT`, and optional `EXPLORER_BASE_URL`.

## Network guard

Guarded `/v1/tx/*`, `/v1/vault/*`, `/v1/admin/*`, `/v1/quote/*` routes:

- **No** `x-solana-network` header → use this deployment’s primary network.
- Header present and ≠ primary → **400** (no silent multi-network switch).

Browser clients should omit the header.

## Issue / redeem

**Issue** (`POST /v1/tx/issue`):

```json
{ "user": "<wallet base58>", "amount": 1000000 }
```

**Redeem** (`POST /v1/tx/redeem`):

```json
{ "user": "<wallet base58>", "amount": 1000000 }
```

Optional `assetMint` when the vault has multiple registered assets.

Response: `{ "transactionB64": "..." }` — bincode-serialized `VersionedTransaction`.

## Redeem quote

**Quote** (`GET /v1/quote/redeem?assetMint=<mint>&amount=<wrapped atoms>`):

```json
{
  "input": 1000000,
  "output": 980000,
  "haircutBps": 200,
  "assetMint": "...",
  "freeLiquidity": 500000,
  "deployedToKamino": 500000,
  "liability": 1000000,
  "redeemEnabled": true,
  "redeemAllowed": true,
  "canRedeem": false,
  "liquidityShortfall": 480000,
  "liabilityShortfall": 0,
  "maxRedeemable": 500000
}
```

- `output` uses the same formula as on-chain `wrapped_to_underlying_amount`
- `freeLiquidity` is the current `token_vault` balance
- `canRedeem` is false when policy blocks, liability exceeds pool obligation, or vault is short
- `POST /v1/tx/redeem` returns 400 when the burn would fail on-chain

## Vault assets

**`GET /v1/vault/assets`** returns per-pool vectors: `backing`, `liability`, `liabilityUnderlying`, `cushion`, `homeSurplus`, `maxRedeemable`, `mintAllowed`, `redeemAllowed`. See [Accounting.md](Accounting.md).

## Compose

`POST /v1/tx/compose` accepts ordered steps:

```json
{
  "user": "<wallet base58>",
  "steps": [
    { "kind": "jupiter_swap", "quote": { } },
    { "kind": "wrap", "amount": 1000000 }
  ]
}
```

Step kinds: `jupiter_swap`, `wrap`, `unwrap`.

Jupiter integration lives entirely in the backend (`backend/src/jupiter.rs`). The on-chain program only sees USDC at the `wrap` boundary.

## Configuration

Set in `.env` (see `.env.example`):

- `SOLANA_RPC_URL`, `SOLANA_NETWORK`, `PROGRAM_ID`, `VAULT_AUTHORITY`, `DEFAULT_ASSET_MINT`
- `CLIENT_SOLANA_RPC_URL`, `CLIENT_SOLANA_WS_URL` (required for bootstrap; aliases `PUBLIC_SOLANA_*`)
- `APP_ENV`, optional `DEPLOYMENT_ID` / `ADMIN_DASHBOARD_URL` / `EXPLORER_BASE_URL`
- Optional `SECRET_NAME` (+ `AWS_REGION`) for AWS Secrets Manager fill-missing-only merge
- `ADMIN_KEYPAIR_PATH` (optional, for `/v1/admin/*`)
- `BIND_PORT` (optional, default 8080)

Network-scoped overrides: `{VAR}_{LOCALNET|DEVNET|MAINNET}` then `{VAR}`.

PDA derivation and instruction building: `backend/src/wrap_stablecoin/`.
