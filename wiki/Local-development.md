# Local development

**Command:** `anchor run local` (from `wrap-stablecoin/`)

**Purpose:** One-shot **persistent localnet** bootstrap — not the same as `anchor test`:

| Command | Lifecycle |
|---------|-----------|
| `anchor test` | Ephemeral validator → deploy → e2e → tear down |
| `anchor run local` | Background validator (logs in same terminal tab) → KLend preload → wrap deploy → vault seed → **auto-write env files** |

Stop the validator: `anchor run stop-local` (alias: `anchor run local-stop`). Add `-- --reset` to wipe the ledger. See [kill.md](../wrap-stablecoin/kill.md).

Full reference: this page. Implementation: `scripts/run_local.sh`.

---

## Prerequisites

### 1. Tools

Rust, Solana CLI, Anchor 0.31+, Node 18+, Yarn — same as [wrap-stablecoin/README.md](../wrap-stablecoin/README.md).

### 2. Environment file

```bash
cd wrap-stablecoin
cp .env.example .env
```

| Variable | Role |
|----------|------|
| `ANCHOR_WALLET_PATH` | Pays bootstrap txs; vault authority/admin (default: `.secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json`) |
| `RPC_PORT` | Validator RPC port (default `8901`) |

### 3. One-time artifacts (not in git)

| Artifact | How to obtain |
|----------|---------------|
| `so/klend.so` | `yarn fetch-klend-so` (mainnet program dump) |
| `fixtures/klend/*.json` | Committed; refresh with `yarn dump-klend` if stale |
| `fixtures/user/*` | Committed; refresh with `yarn make-user-fixture` |
| `target/deploy/wrap_stablecoin.so` | Built by `anchor build` (run automatically) |

---

## Quick start

```bash
cd wrap-stablecoin
yarn install
cp .env.example .env
anchor run local
```

Seed auto-writes:

- `backend/.env` — Solana RPC, program id, vault authority, `CLIENT_SOLANA_*`, etc. (preserves unrelated keys)
- `frontend/.env.local` / `admin-frontend/.env.local` — `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080` only
- `deployments/localnet.json` — machine-readable deploy artifact

```bash
# Terminal 2 — backend
cd backend
cargo run

# Terminal 3 — frontend
cd frontend
pnpm run dev

# Terminal 4 — admin (optional)
cd admin-frontend
pnpm run dev
```

Validate bootstrap:

```bash
curl -s http://127.0.0.1:8080/v1/client-config | jq .
```

---

## Execution phases

`scripts/run_local.sh` runs these phases:

### Phase A — Env

Sources `.env`, sets `CLUSTER=localnet`, `RPC_URL`, `ANCHOR_WALLET_PATH`.

### Phase B — Build prep

Stops prior validator, fetches `so/klend.so` if missing, `anchor keys sync`, `anchor build`.

### Phase C — Validator (background)

Starts `solana-test-validator` with trailing `&` (opinions-market style):

- **No `--quiet`** — default slot/processed UI prints in the terminal tab that ran `anchor run local`
- **No log-file redirect** — visibility comes from keeping that tab open, not a separate attach step
- Script does **not** stop the validator at exit; only `pkill` / `local-stop` tear it down

Preloads:

- KLend BPF at mainnet program id
- `wrap_stablecoin.so` at localnet program id
- Cloned mainnet KLend USDC reserve fixtures
- Fixture wallet (100 SOL + 1M USDC)
- Slot warp from `fixtures/klend/slot.txt`

PID written to `.localnet/validator.pid`. Warmup: `sleep 3` then RPC health check.

**Smoke test** (`run_backend_smoke.sh`) sets `LOCAL_VALIDATOR_LOG_TO_FILE=1` for quiet output to `/tmp/smoke-logs/validator.log` instead.

### Phase D — Vault seeding

`scripts/seed_localnet.ts` — idempotent:

| Step | Instruction | Skip if |
|------|-------------|---------|
| 1 | `initialize` | `vault_config` exists |
| 2 | `add_asset(USDC)` | `asset_config` exists |
| 3 | `enable_klend` | `klend_config` exists |
| — | `bootstrap_dummy_mints` (CCC / TTT, 100M each to admin) | always tops up admin balance |

### Phase E — Env sync

`scripts/sync_local_env.ts` (called from seed) merges backend keys and writes frontend `.env.local` files. Manual copy-paste is no longer required.

Re-run sync alone (after editing `deployments/localnet.json`):

```bash
cd wrap-stablecoin && yarn sync-local-env
```

---

## Kamino on localnet

KLend is **not built from source**. The validator preloads:

1. **Mainnet bytecode** — `so/klend.so`
2. **Mainnet account snapshots** — `fixtures/klend/` (market, reserve, oracle, mints)
3. **Slot warp** — keeps reserve/oracle timestamps within KLend staleness windows

This matches `anchor test` and enables real CPIs: `deposit_to_klend`, `withdraw_from_klend`, `harvest_yield`.

Regenerate fixtures if you see `Reserve is stale`:

```bash
yarn dump-klend
# update warp_slot in Anchor.toml if slot.txt changed
```

---

## Related scripts

| Script | Purpose |
|--------|---------|
| `anchor run local` | Full bootstrap (validator + seed + env sync) |
| `anchor run stop-local` | Stop background validator (`local-stop` is an alias) |
| `yarn fetch-klend-so` | Download KLend bytecode |
| `yarn sync-local-env` | Re-apply `deployments/localnet.json` → env files |
| `./scripts/run_backend_smoke.sh` | Ephemeral validator + backend + API smoke test |
| `../scripts/check_frontend_env.sh` | Ban retired `NEXT_PUBLIC_*` product env vars |

---

## Gotchas

- **Validator stays running** after `anchor run local` exits — background job in the same shell; **keep that terminal tab open** for live logs. Stop with `anchor run local-stop` or `kill -9 $(lsof -ti:8901)`.
- **`so/klend.so` not in git** — run `yarn fetch-klend-so` on fresh clones.
- **Do not use `anchor localnet`** — broken on Anchor 0.31.1 for this workspace; use `anchor run local`.
- **Program ID** must match `target/deploy/wrap_stablecoin-keypair.json` (printed by `anchor run local`). Backend `PROGRAM_ID` is written by env sync — do not assume a fixed pubkey across clones.
- **`anchor test` is separate** — ephemeral lifecycle; does not depend on persistent localnet. Runs `tests/cross_asset.ts` (CCC / TTT liability doctrine) then `tests/e2e.ts` (USDC + KLend).
- **Dummy tokens (CCC / TTT)** — vault-only test mints in `dummy-tokens/`. Bootstrap on a running validator: `yarn bootstrap-dummy-mints` (idempotent mint creation + payer funding). `anchor test` bootstraps them automatically in the cross-asset suite.
- **Frontends are deployment-dumb** — only `NEXT_PUBLIC_BACKEND_URL`; all RPC/program/mint/network config comes from `GET /v1/client-config`.
