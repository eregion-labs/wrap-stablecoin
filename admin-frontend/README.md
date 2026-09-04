# Florin Admin

Operator console for vault mint operations and collateral policy. **No wallet connection** — the backend signs and submits transactions using the configured vault admin keypair.

## Setup

```bash
pnpm install
```

Set **only** `NEXT_PUBLIC_BACKEND_URL` in `.env.local` (e.g. `http://127.0.0.1:8080`). Deployment config (cluster, program id, links) is fetched from `GET /v1/client-config`.

The API must have `ADMIN_KEYPAIR_PATH` set (see `backend/.env.example`).

## Dev

```bash
pnpm dev
```

Runs on port **3002**.

## Pages

- **/** — Mint dashboard (wrap/redeem via backend admin wallet + pool accounting)
- **/reserves** — Register collateral, per-asset policy, and pool accounts
- **/vault** — Pause, wrap/unwrap access, allowlist, admin transfer, mint-authority handoff
- **/policy** — Redirects to `/reserves`
