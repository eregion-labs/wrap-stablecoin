#!/usr/bin/env bash
# Orchestrates a localnet + backend smoke test (without anchor localnet, which
# is broken in 0.31.1 — it panics at cli/src/lib.rs:4704 on our workspace).
#
#   1. solana-test-validator with KLend fixtures + both programs preloaded
#   2. waits for RPC_PORT (default 8901)
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
BACKEND_LOG="$LOG_DIR/backend.log"

# shellcheck source=local_env.sh
source "$ROOT/scripts/local_env.sh"

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
  rm -f "$PID_FILE"
  exit "$ec"
}
trap cleanup EXIT INT TERM

cd "$ROOT"
mkdir -p "$LOG_DIR"

bash "$ROOT/scripts/local_stop.sh" 2>/dev/null || true
local_env_kill_prior_validators
bash "$ROOT/scripts/fetch_klend_so.sh"
anchor build
local_env_resolve_program_id
local_env_check_files

echo "[1/5] starting solana-test-validator on :${RPC_PORT} (log: $VALIDATOR_LOG)…"
LOCAL_VALIDATOR_LOG_TO_FILE=1 local_env_start_validator --reset

echo "[2/5] waiting for validator on :${RPC_PORT}…"
local_env_wait_for_rpc 90

echo "[3/5] starting backend (log: $BACKEND_LOG)…"
cd "$BACKEND_DIR"
# Inject all required public-config keys so smoke does not depend on a stale backend/.env.
APP_ENV="local" \
SOLANA_RPC_URL="$RPC_URL" \
SOLANA_NETWORK="localnet" \
PROGRAM_ID="$PROGRAM_ID" \
VAULT_AUTHORITY="$FIXTURE_WALLET_PUBKEY" \
DEFAULT_ASSET_MINT="${DEFAULT_ASSET_MINT:-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v}" \
CLIENT_SOLANA_RPC_URL="$RPC_URL" \
CLIENT_SOLANA_WS_URL="ws://127.0.0.1:$((RPC_PORT - 1))" \
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
