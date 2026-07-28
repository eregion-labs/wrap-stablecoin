# Frontend

Next.js 16 app with MUI and Solana wallet adapter.

Source: `frontend/src/` (public app) and `admin-frontend/src/` (operator console).

## Stack

- **Next.js 16** — App router
- **MUI** — UI components
- **Wallet Standard + Wallet Adapter** — `@solana/wallet-adapter-react` with `wallets={[]}` (auto-detects Phantom, Solflare, Backpack, Coinbase Wallet, etc.)
- **Zod** — validates `GET /v1/client-config` (`@florin/client-config`)
- **notistack** — transaction feedback

## Bootstrap

```text
NEXT_PUBLIC_BACKEND_URL
        ↓
GET /v1/client-config
        ↓
Zod validate + Object.freeze
        ↓
createApplicationServices → API client + (public app) Solana ConnectionProvider
        ↓
Render UI
```

`ClientConfigProvider` blocks wallet/providers until config is ready. Fatal validation errors show the backend URL and field path; transport errors are retryable.

There is **no** in-app network switch. Point `NEXT_PUBLIC_BACKEND_URL` at a local or development API deployment to select environment.

## Wallet integration (public app)

```text
Wallet Standard (browser wallets)
        ↓
@solana/wallet-adapter-react  (ConnectionProvider → WalletProvider → useWallet)
        ↓
@solana/wallet-adapter-react-ui  (WalletModalProvider + useWalletModal)
```

RPC endpoint comes from frozen client-config (`solana.rpcUrl`), not from frontend env.

## Main flow

`WrapRedeemPanel` (`frontend/src/components/WrapRedeemPanel.tsx`):

1. User connects wallet via **AppHeader** → `WalletNavButton` (top right)
2. Panel loads `GET /v1/vault/assets` (per-pool liability, liquidity, surplus)
3. Redeem flow polls `GET /v1/quote/redeem` for `canRedeem`, shortfalls, and `maxRedeemable`
4. User enters wrap (issue) or unwrap (redeem) amount
5. Frontend calls backend `POST /v1/tx/issue` or `POST /v1/tx/redeem` (no `x-solana-network`)
6. Issue/redeem buttons disabled when `!mintAllowed` or `!canRedeem`
7. Deserializes `transactionB64` to `VersionedTransaction`
8. Signs and sends via wallet; simulate buttons call `/v1/tx/preview` path via local simulation

API client: `frontend/src/lib/api.ts` (uses bootstrap services).

## Configuration

`.env.local` (both apps) — see `.env.example`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend origin (trailing slash normalized once) |

That is the **entire** product deployment surface. All other deployment public config comes from `/v1/client-config` (network, RPC, WS, program ids, default mint, explorer base URL, feature flags, links).

Static enforcement: `./scripts/check_frontend_env.sh`

## Run locally

```bash
cd frontend   # or admin-frontend
pnpm install
pnpm run dev
```

- Public app: http://localhost:3001
- Admin: http://localhost:3002

## Providers

- `ClientConfigProvider` — fetch / validate / freeze public config
- `SolanaWalletProviders` (public only) — `ConnectionProvider` + Wallet Standard `WalletProvider`
- `AppShell` / `AppHeader` — sticky navbar (read-only deployment chip)
- `providers.tsx` — theme, snackbar, bootstrap
