#!/usr/bin/env bash
# Orchestrates a localnet + backend smoke test (without anchor localnet, which
# is broken in 0.31.1 — it panics at cli/src/lib.rs:4704 on our workspace).
#
#   1. solana-test-validator with KLend fixtures + both programs preloaded
#   2. waits for :8899
#   3. starts the backend on :8080 pointed at localnet
#   4. waits for /ping
#   5. runs `scripts/backend_smoke.ts`
#   6. tears down both background processes
#
# Usage: from wrap-stablecoin/ :  ./scripts/run_backend_smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT/../backend"
LOG_DIR="${LOG_DIR:-/tmp/smoke-logs}"
LEDGER_DIR="${LEDGER_DIR:-/tmp/smoke-ledger}"
mkdir -p "$LOG_DIR"

VALIDATOR_LOG="$LOG_DIR/validator.log"
BACKEND_LOG="$LOG_DIR/backend.log"

# Fixture wallet from Anchor.toml — VAULT_AUTHORITY seed.
FIXTURE_WALLET_PUBKEY="5s72BFe78FWbXRzPHGoq7p8J6Ky2qWWDf4Nmk5aWWxtU"
PROGRAM_ID="5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT"
KLEND_PROGRAM_ID="KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
WARP_SLOT=413424802

VALIDATOR_PID=""
BACKEND_PID=""

cleanup() {
  local ec=$?
  echo
  echo "[cleanup] tearing down…"
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$VALIDATOR_PID" ]] && kill -0 "$VALIDATOR_PID" 2>/dev/null; then
    kill "$VALIDATOR_PID" 2>/dev/null || true
    wait "$VALIDATOR_PID" 2>/dev/null || true
  fi
  exit "$ec"
}
trap cleanup EXIT INT TERM

cd "$ROOT"

# Sanity: fixtures and built programs must exist.
for f in \
  "so/klend.so" \
  "target/deploy/kamino_tester.so" \
  "fixtures/klend/lending_market.json" \
  "fixtures/klend/reserve.json" \
  "fixtures/klend/reserve_liquidity_supply.json" \
  "fixtures/klend/reserve_collateral_mint.json" \
  "fixtures/klend/reserve_fee_vault.json" \
  "fixtures/klend/liquidity_mint_usdc.json" \
  "fixtures/klend/scope_prices.json" \
  "fixtures/user/wallet_account.json" \
  "fixtures/user/usdc_ata.json" \
  ; do
  [[ -f "$f" ]] || { echo "missing fixture: $f"; exit 1; }
done

rm -rf "$LEDGER_DIR"

echo "[1/5] starting solana-test-validator (log: $VALIDATOR_LOG)…"
solana-test-validator --reset --quiet \
  --ledger "$LEDGER_DIR" \
  --warp-slot "$WARP_SLOT" \
  --bpf-program "$KLEND_PROGRAM_ID" so/klend.so \
  --bpf-program "$PROGRAM_ID" target/deploy/kamino_tester.so \
  --account 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF fixtures/klend/lending_market.json \
  --account D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59 fixtures/klend/reserve.json \
  --account Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6 fixtures/klend/reserve_liquidity_supply.json \
  --account B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D fixtures/klend/reserve_collateral_mint.json \
  --account BbDUrk1bVtSixgQsPLBJFZEF7mwGstnD5joA1WzYvYFX fixtures/klend/reserve_fee_vault.json \
  --account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v fixtures/klend/liquidity_mint_usdc.json \
  --account 3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH fixtures/klend/scope_prices.json \
  --account 5s72BFe78FWbXRzPHGoq7p8J6Ky2qWWDf4Nmk5aWWxtU fixtures/user/wallet_account.json \
  --account Fs2pMyCiKAfnhG6ucMLWSW945UrUkfcLP5UFsASKbbK1 fixtures/user/usdc_ata.json \
  >"$VALIDATOR_LOG" 2>&1 &
VALIDATOR_PID=$!

echo "[2/5] waiting for validator on :8899…"
for i in $(seq 1 90); do
  if solana cluster-version -u http://127.0.0.1:8899 >/dev/null 2>&1; then
    echo "    validator up (after ${i}s)"
    break
  fi
  sleep 1
  if ! kill -0 "$VALIDATOR_PID" 2>/dev/null; then
    echo "    validator died — last 40 lines:"
    tail -40 "$VALIDATOR_LOG"
    exit 1
  fi
  if [[ $i -eq 90 ]]; then
    echo "    validator did not start within 90s — last 40 lines:"
    tail -40 "$VALIDATOR_LOG"
    exit 1
  fi
done

echo "[3/5] starting backend (log: $BACKEND_LOG)…"
cd "$BACKEND_DIR"
SOLANA_RPC_URL="http://127.0.0.1:8899" \
SOLANA_NETWORK="localnet" \
VAULT_AUTHORITY="$FIXTURE_WALLET_PUBKEY" \
BIND_HOST="127.0.0.1" \
BIND_PORT="8080" \
  cargo run --quiet >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo "[4/5] waiting for backend /ping…"
for i in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:8080/ping >/dev/null 2>&1; then
    echo "    backend up (after ${i}s)"
    break
  fi
  sleep 1
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "    backend died — last 40 lines:"
    tail -40 "$BACKEND_LOG"
    exit 1
  fi
  if [[ $i -eq 120 ]]; then
    echo "    backend did not start within 120s — last 40 lines:"
    tail -40 "$BACKEND_LOG"
    exit 1
  fi
done

echo "[5/5] running backend_smoke.ts…"
cd "$ROOT"
yarn ts-node scripts/backend_smoke.ts
