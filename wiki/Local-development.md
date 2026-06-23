# Local development

**Command:** `anchor run local` (from `wrap-stablecoin/`)

**Purpose:** One-shot **persistent localnet** bootstrap — not the same as `anchor test`:

| Command | Lifecycle |
|---------|-----------|
| `anchor test` | Ephemeral validator → deploy → e2e → tear down |
| `anchor run local` | Background validator (logs in same terminal tab) → KLend preload → wrap deploy → vault seed → print env |

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
| `ANCHOR_WALLET_PATH` | Pays bootstrap txs; vault authority/admin (default: `fixtures/user/wallet.json`) |
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

The script prints an env block — copy into `backend/.env` and `frontend/.env.local`, then start those services manually.

```bash
# Terminal 2 — backend
cd backend
# SOLANA_RPC_URL=http://127.0.0.1:8901
# SOLANA_NETWORK=localnet
# PROGRAM_ID=<from anchor run local output>
# VAULT_AUTHORITY=5s72BFe78FWbXRzPHGoq7p8J6Ky2qWWDf4Nmk5aWWxtU
cargo run

# Terminal 3 — frontend
cd frontend
# NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080
# NEXT_PUBLIC_SOLANA_NETWORK=localnet
npm run dev
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

### Phase E — Env snippets

Prints `SOLANA_RPC_URL`, `PROGRAM_ID`, `VAULT_AUTHORITY`, `WRAPPED_MINT`, etc.

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
| `anchor run local` | Full bootstrap (validator + seed) |
| `anchor run stop-local` | Stop background validator (`local-stop` is an alias) |
| `yarn fetch-klend-so` | Download KLend bytecode |
| `./scripts/run_backend_smoke.sh` | Ephemeral validator + backend + API smoke test |

---

## Gotchas

- **Validator stays running** after `anchor run local` exits — background job in the same shell; **keep that terminal tab open** for live logs. Stop with `anchor run local-stop` or `kill -9 $(lsof -ti:8901)`.
- **`so/klend.so` not in git** — run `yarn fetch-klend-so` on fresh clones.
- **Do not use `anchor localnet`** — broken on Anchor 0.31.1 for this workspace; use `anchor run local`.
- **Program ID** must match `target/deploy/wrap_stablecoin-keypair.json` (printed by `anchor run local`). Set backend `PROGRAM_ID` from the env block — do not assume a fixed pubkey across clones.
- **`anchor test` is separate** — ephemeral lifecycle; does not depend on persistent localnet.
