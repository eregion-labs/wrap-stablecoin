# Backend API

Rust service (Axum + utoipa + Solana SDK) that builds **unsigned** wrap/unwrap transactions and executes **server-signed** admin vault / KLend ops.

Source: `backend/src/`

One process serves **exactly one** Solana network. Frontends discover public deployment config via REST bootstrap (not GraphQL).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ping` | Health check (`network`, `deploymentId`) |
| `GET` | `/v1/client-config` | Immutable public bootstrap config (schemaVersion 1) |
| `GET` | `/v1/vault/assets` | Per-asset vault balances, policy, and vault governance fields |
| `GET` | `/v1/vault/meta` | Vault admin, pause/public flags, pending transfers, allowlist, wrapped mint, Metaplex metadata |
| `GET` | `/v1/vault/token-holders` | Largest FLRN token accounts (RPC top 20; keys are token accounts) |
| `GET` | `/v1/quote/issue` | Expected wrap output, mint haircut, and optional `accessAllowed` |
| `GET` | `/v1/quote/redeem` | Expected unwrap output, redemption haircut, and optional `accessAllowed` |
| `POST` | `/v1/tx/issue` | Unsigned wrap transaction |
| `POST` | `/v1/tx/redeem` | Unsigned unwrap transaction |
| `POST` | `/v1/tx/preview` | Simulate a transaction |
| `POST` | `/v1/admin/register-asset` | Server-signed `add_asset` |
| `POST` | `/v1/admin/update-asset-policy` | Server-signed policy update |
| `POST` | `/v1/admin/mint` | Server-signed wrap from admin wallet |
| `POST` | `/v1/admin/redeem` | Server-signed unwrap from admin wallet |
| `POST` | `/v1/admin/deposit-to-klend` | Deploy `amount` to Kamino |
| `POST` | `/v1/admin/deposit-all-to-klend` | Deploy `vault − cushion` to Kamino |
| `POST` | `/v1/admin/withdraw-from-klend` | Recall `collateralAmount` kTokens |
| `POST` | `/v1/admin/withdraw-all-from-klend` | Recall full Kamino position |
| `POST` | `/v1/admin/harvest-yield` | Harvest kToken surplus to treasury |
| `POST` | `/v1/admin/sweep-home-surplus` | Sweep home-vault surplus to treasury |
| `POST` | `/v1/admin/withdraw-treasury` | Send treasury tokens to a destination wallet |
| `POST` | `/v1/admin/set-paused` | Global pause flag |
| `POST` | `/v1/admin/set-wrap-public` | Public wrap (false requires allowlist) |
| `POST` | `/v1/admin/set-unwrap-public` | Public unwrap (false requires allowlist) |
| `POST` | `/v1/admin/init-allowlist` | Initialize allowlist PDA (once) |
| `POST` | `/v1/admin/add-to-allowlist` | Add one or more wallets (`pubkey` and/or `pubkeys[]`; max 64) |
| `POST` | `/v1/admin/remove-from-allowlist` | Remove a wallet from the allowlist |
| `POST` | `/v1/admin/transfer-authority` | Propose two-step admin transfer |
| `POST` | `/v1/admin/cancel-transfer-authority` | Cancel pending admin transfer |
| `POST` | `/v1/admin/accept-authority/tx` | Unsigned `accept_authority` (signer = `pendingAdmin`) |
| `POST` | `/v1/admin/accept-authority` | Execute accept if `ADMIN_KEYPAIR` is the pending destination |
| `POST` | `/v1/admin/enable-klend` | One-shot Kamino enable for a registered asset |
| `POST` | `/v1/admin/propose-mint-authority` | Propose SPL mint-authority handoff |
| `POST` | `/v1/admin/cancel-propose-mint-authority` | Cancel pending mint-authority proposal |
| `POST` | `/v1/admin/accept-mint-authority/tx` | Unsigned `accept_mint_authority` (permanently disables wrap) |
| `POST` | `/v1/admin/accept-mint-authority` | Execute accept if `ADMIN_KEYPAIR` is the pending mint authority |

OpenAPI / Swagger: `/doc`

Server-signed admin routes require **both** `ADMIN_KEYPAIR_PATH` and `ADMIN_API_TOKEN`, and every
request must carry `Authorization: Bearer <ADMIN_API_TOKEN>`:

| Condition | Response |
| --- | --- |
| Missing or non-`Bearer` `Authorization` header | `401` |
| Token does not match `ADMIN_API_TOKEN` | `401` |
| `ADMIN_API_TOKEN` unset | `503` (routes disabled) |
| `ADMIN_KEYPAIR_PATH` unset | `503` |

Reaching one of these routes is equivalent to holding the vault admin key, so the token is a
production credential: at least 32 characters, unique per deployment, and supplied via
`SECRET_NAME` (AWS Secrets Manager) rather than a checked-in `.env` wherever possible. The
backend **refuses to start** when `ADMIN_KEYPAIR_PATH` is set and `ADMIN_API_TOKEN` is not, so a
deployment can never serve an unauthenticated admin signer.

The token is not a substitute for network controls, and neither is CORS — CORS is enforced by
browsers, so it stops a drive-by page from driving the API but does nothing about a direct
client. Keep `/v1/admin/*` off the public internet.

**Listen address.** `BIND_HOST` defaults to `127.0.0.1`, since this process holds the vault admin
key. Set `0.0.0.0` only when it must be reachable off-host (e.g. a container), and put access
control in front of it.

**Browser origins.** Cross-origin requests are restricted to an exact-match allowlist, built from
`PUBLIC_APP_URL` and `ADMIN_DASHBOARD_URL` (path stripped to the origin), plus any comma-separated
extras in `CORS_ALLOWED_ORIGINS`. With `APP_ENV=local` the localhost dev servers on ports
3000-3002 are added automatically. When nothing is configured the allowlist is empty, permitting
same-origin requests only — correct when the API and app share an origin. A cross-origin frontend
must therefore have `PUBLIC_APP_URL` (or `CORS_ALLOWED_ORIGINS`) set, or the browser will block
its calls. Invalid URLs fail at startup rather than surfacing as opaque browser errors.

`/v1/tx/admin/*` needs **no** token: those routes only build unsigned transactions, which the
chain rejects unless the real admin signs them. Unsigned accept `/tx` routes do **not** take a
destination secret. KLend CPI routes prepend KLend `refresh_reserve`; configure extra Scope oracles with `KLEND_SCOPE_PRICES_<reserve>=<oracle>` (USDC mainnet/localnet default is built in).

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
    "capabilities": { "adminDashboard": true }
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

Wrap and unwrap instructions always occupy the Anchor `Option<Allowlist>` slot **before** `collateral_token_program` and `florin_token_program` (account index 9, then 10 and 11). Florin is classic SPL (`TOKEN_PROGRAM_ID`); collateral is the mint owner (SPL or Token-2022). When wrap/unwrap is public, or the caller is vault admin, the allowlist slot is the program-id sentinel. When the flag is private, it is the allowlist PDA (400 if the PDA is missing). Private non-admin callers must be members; otherwise `POST /v1/tx/issue` and `/v1/tx/redeem` return 400 `"not on allowlist"`. Paused vaults return `"vault is paused"`. Wrap also returns `"mint authority transferred"` after `accept_mint_authority`. Admin mint/redeem uses the same account list (admin bypasses membership on-chain, still needs a valid slot).

## Quotes

Optional `user=<wallet>` on both quotes sets `accessAllowed` (`true` if the flag is public, the user is admin, or the allowlist contains the user). Omit `user` → `accessAllowed` is `null`. Amounts are atoms.

**Issue** (`GET /v1/quote/issue?assetMint=<mint>&amount=<underlying atoms>&user=`):

```json
{
  "input": 1000000,
  "output": 1000000,
  "haircutBps": 0,
  "assetMint": "...",
  "mintEnabled": true,
  "mintAllowed": true,
  "canMint": true,
  "mintCap": 0,
  "mintCapRemaining": null,
  "accessAllowed": true
}
```

- `output` uses on-chain `underlying_to_wrapped_amount` (mint haircut)
- `mintCapRemaining` is `null` when `mintCap` is 0 (unlimited)
- `canMint` is false when paused, mint authority transferred, mint disabled, or the cap would be exceeded

**Redeem** (`GET /v1/quote/redeem?assetMint=<mint>&amount=<wrapped atoms>&user=`):

```json
{
  "input": 1000000,
  "output": 800000,
  "haircutBps": 2000,
  "assetMint": "...",
  "freeLiquidity": 500000,
  "deployedToKamino": 500000,
  "liability": 1000000,
  "redeemEnabled": true,
  "redeemAllowed": true,
  "canRedeem": false,
  "liquidityShortfall": 0,
  "liabilityShortfall": 0,
  "maxRedeemable": 500000,
  "accessAllowed": true
}
```

- `output` uses on-chain `wrapped_to_underlying_amount` (redemption haircut; percent = `haircutBps / 100`)
- `freeLiquidity` is the current `token_vault` balance
- `canRedeem` is false when paused, policy blocks, liability exceeds pool obligation, or vault is short
- `POST /v1/tx/redeem` returns 400 when the burn would fail on-chain

## Vault assets and meta

**`GET /v1/vault/assets`** returns per-pool vectors: `backing`, `liability`, `liabilityUnderlying`, `cushion`, `homeSurplus`, `maxRedeemable`, `mintAllowed`, `redeemAllowed`. See [Accounting.md](Accounting.md).

Both **`GET /v1/vault/meta`** and **`GET /v1/vault/assets`** include vault governance:

| Field | Meaning |
|---|---|
| `wrapPublic` / `unwrapPublic` | When false, wrap/unwrap requires the allowlist PDA |
| `pendingAdmin` | Proposed admin, or `null` if none |
| `pendingMintAuthority` | Proposed SPL mint authority, or `null` if none |
| `mintAuthorityTransferred` | `true` after `accept_mint_authority` — wrap is permanently disabled |
| `allowlist` | Member pubkeys, or `null` if the Allowlist PDA is not initialized |

## Admin KLend bodies

Optional `assetMint` defaults to `DEFAULT_ASSET_MINT`.

```json
{ "assetMint": "...", "amount": 1000000 }
```

Used by `deposit-to-klend` and `sweep-home-surplus`.

```json
{ "assetMint": "...", "collateralAmount": 1000000 }
```

Used by `withdraw-from-klend` and `harvest-yield` (kToken atoms).

```json
{ "assetMint": "...", "amount": 1000000, "destination": "<wallet base58>" }
```

`withdraw-treasury` treats `destination` as a wallet and creates the ATA if missing.

Response: `{ "signature": "..." }`.

## Admin governance bodies

Bool flags (`set-paused`, `set-wrap-public`, `set-unwrap-public`):

```json
{ "value": true }
```

Allowlist member (`remove-from-allowlist`):

```json
{ "pubkey": "<wallet base58>" }
```

Add members (`add-to-allowlist`) — `pubkey` and/or `pubkeys`. Sequential signed txs; stops on first error. On-chain max is 64 (`AllowlistFull`).

```json
{ "pubkey": "<wallet base58>" }
```

```json
{ "pubkeys": ["<wallet base58>", "<wallet base58>"] }
```

Response: `{ "signature": "<last tx>", "count": 2 }`.

Admin transfer:

```json
{ "newAdmin": "<wallet base58>" }
```

Mint-authority propose:

```json
{ "newMintAuthority": "<wallet or program pubkey>" }
```

Enable Kamino (one-shot per asset):

```json
{
  "assetMint": "...",
  "lendingMarket": "...",
  "reserve": "...",
  "reserveLiquiditySupply": "...",
  "collateralMint": "..."
}
```

`init-allowlist`, `cancel-transfer-authority`, and `cancel-propose-mint-authority` take an empty JSON object.

### Destination-signed accepts

`POST /v1/admin/accept-authority/tx` and `POST /v1/admin/accept-mint-authority/tx` return `{ "transactionB64": "..." }` (bincode `VersionedTransaction`). The fee payer / signer is the on-chain pending destination. The Chamber UI signs in the browser from a keypair JSON file; the secret never hits the backend.

`accept_mint_authority` remaining accounts are every registered `AssetConfig` PDA in vault order. Accepting **permanently disables wrap**.

If `ADMIN_KEYPAIR` equals the pending destination, `POST /v1/admin/accept-authority` and `POST /v1/admin/accept-mint-authority` will execute server-side; otherwise they return 400 and the `/tx` route must be used.

## Configuration

Set in `.env` (see `.env.example`):

- `SOLANA_RPC_URL`, `SOLANA_NETWORK`, `PROGRAM_ID`, `VAULT_AUTHORITY`, `DEFAULT_ASSET_MINT`
- `CLIENT_SOLANA_RPC_URL`, `CLIENT_SOLANA_WS_URL` (required for bootstrap; aliases `PUBLIC_SOLANA_*`)
- `APP_ENV`, optional `DEPLOYMENT_ID` / `ADMIN_DASHBOARD_URL` / `EXPLORER_BASE_URL`
- Optional `SECRET_NAME` (+ `AWS_REGION`) for AWS Secrets Manager fill-missing-only merge
- `ADMIN_KEYPAIR_PATH` (optional, for `/v1/admin/*`)
- `KLEND_SCOPE_PRICES_<reserve>` (optional extra Scope oracles)
- `BIND_PORT` (optional, default 8080)

Network-scoped overrides: `{VAR}_{LOCALNET|DEVNET|MAINNET}` then `{VAR}`.

PDA derivation and instruction building: `backend/src/wrap_stablecoin/`.
