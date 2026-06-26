# frontend

Public-facing Next.js app for Florin (FLRN) wrap and redeem. Users connect a wallet to sign transactions.

Set `NEXT_PUBLIC_API_BASE` in `.env.local` (default `http://127.0.0.1:8080`), then `pnpm install` and `pnpm dev` (port **3001**).

Operator tools (mint dashboard, collateral policy) live in **`admin-frontend/`** (port **3002**) and use backend-signed admin transactions — no wallet in the browser.
