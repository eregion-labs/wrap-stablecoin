# wStable Admin

Operator console for vault mint operations and collateral policy. **No wallet connection** — the backend signs and submits transactions using the configured vault admin keypair.

## Setup

```bash
pnpm install
```

Set `NEXT_PUBLIC_API_BASE` in `.env.local` (default `http://127.0.0.1:8080`).

The API must have `{NETWORK}_ADMIN_KEYPAIR_PATH` set (see `backend/.env`).

## Dev

```bash
pnpm dev
```

Runs on port **3002**.

## Pages

- **/** — Mint dashboard (wrap/redeem via backend admin wallet + pool accounting)
- **/policy** — Register collateral and configure per-asset policy
