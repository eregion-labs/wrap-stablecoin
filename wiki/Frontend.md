# Frontend

Next.js 16 app with MUI and Solana wallet adapter.

Source: `frontend/src/`

## Stack

- **Next.js 16** — App router
- **MUI** — UI components
- **Wallet Standard + Wallet Adapter** — `@solana/wallet-adapter-react` with `wallets={[]}` (auto-detects Phantom, Solflare, Backpack, Coinbase Wallet, etc.)
- **notistack** — transaction feedback

## Wallet integration

```text
Wallet Standard (browser wallets)
        ↓
@solana/wallet-adapter-react  (ConnectionProvider → WalletProvider → useWallet)
        ↓
@solana/wallet-adapter-react-ui  (WalletModalProvider + useWalletModal)
```

No vendor-specific SDKs. `SolanaWalletProviders` passes an empty `wallets` array; `WalletProvider` merges Wallet Standard adapters at runtime. **Do not** mount a second `<WalletModal />` — `WalletModalProvider` owns the picker.

Layout: `AppShell` → sticky `AppHeader` (brand + `WalletNavButton`). Connected users get a dropdown: copy address, change wallet, disconnect.

Components use `useWallet()` / `useConnection()` from `@solana/wallet-adapter-react`.

## Main flow

`WrapRedeemPanel` (`frontend/src/components/WrapRedeemPanel.tsx`):

1. User connects wallet via **AppHeader** → `WalletNavButton` (top right)
2. Panel loads `GET /v1/vault/assets` (per-pool liability, liquidity, surplus)
3. Redeem flow polls `GET /v1/quote/redeem` for `canRedeem`, shortfalls, and `maxRedeemable`
4. User enters wrap (issue) or unwrap (redeem) amount
5. Frontend calls backend `POST /v1/tx/issue` or `POST /v1/tx/redeem`
6. Issue/redeem buttons disabled when `!mintAllowed` or `!canRedeem`
7. Deserializes `transactionB64` to `VersionedTransaction`
8. Signs and sends via wallet; simulate buttons call `/v1/tx/preview` path via local simulation

API client: `frontend/src/lib/api.ts`

## Configuration

`.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE` | Backend origin (no trailing slash) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` / `mainnet` / `localnet` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Optional RPC override (default localnet: `http://127.0.0.1:8901`) |

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Default: http://localhost:3001

## Providers

- `SolanaWalletProviders` — `ConnectionProvider` + Wallet Standard `WalletProvider`
- `AppShell` / `AppHeader` — sticky navbar with `WalletNavButton`
- `providers.tsx` — app-wide providers (theme, snackbar, etc.)
