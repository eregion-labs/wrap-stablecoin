# frontend

Public-facing Next.js app for Florin (FLRN) wrap and redeem. Users connect a wallet to sign transactions.

Set **only** `NEXT_PUBLIC_BACKEND_URL` in `.env.local` (e.g. `http://127.0.0.1:8080`). Cluster, RPC, program id, and default mint are loaded from `GET /v1/client-config` at bootstrap.

```bash
pnpm install
pnpm dev   # port 3001
```

Operator tools (mint dashboard, collateral policy) live in **`admin-frontend/`** (port **3002**) and use backend-signed admin transactions — no wallet in the browser.
