# Backend API

Rust service (Axum + utoipa + Solana SDK) that builds **unsigned** transactions for wrap/unwrap and optional Jupiter composition.

Source: `backend/src/`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ping` | Health check |
| `GET` | `/v1/vault/assets` | Per-asset vault balances and policy |
| `GET` | `/v1/quote/redeem` | Expected unwrap output and free liquidity |
| `POST` | `/v1/tx/issue` | Unsigned wrap transaction |
| `POST` | `/v1/tx/redeem` | Unsigned unwrap transaction |
| `POST` | `/v1/tx/preview` | Simulate a transaction |
| `POST` | `/v1/tx/compose` | Multi-step Jupiter + wrap/unwrap bundle |

OpenAPI / Swagger: `/doc`

## Network guard

`/v1/tx/*` routes require an `x-solana-network` header matching the server's configured cluster so clients never receive txs built for the wrong network.

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

- `SOLANA_RPC_URL`
- `PROGRAM_ID`
- `VAULT_AUTHORITY` — seeds `vault_config` PDA
- `BIND_PORT` (optional, default 8080)

PDA derivation and instruction building: `backend/src/wrap_stablecoin/`.
