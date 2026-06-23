#!/usr/bin/env bash
# Stop the background solana-test-validator started by anchor run local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=local_env.sh
source "$ROOT/scripts/local_env.sh"

RESET_LEDGER=0
for arg in "$@"; do
  case "$arg" in
    --reset) RESET_LEDGER=1 ;;
    -h|--help)
      echo "Usage: $0 [--reset]"
      echo "  --reset  also remove ledger dir ($LEDGER_DIR)"
      exit 0
      ;;
  esac
done

stopped=0

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping validator (pid $pid)…"
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    stopped=1
  fi
  rm -f "$PID_FILE"
fi

# Fallback: kill by RPC port (opinions-market kill.md pattern).
if port_pids="$(lsof -ti:"$RPC_PORT" 2>/dev/null || true)"; then
  if [[ -n "$port_pids" ]]; then
    # shellcheck disable=SC2086
    kill -9 $port_pids 2>/dev/null || true
    stopped=1
  fi
fi

if pkill -f "solana-test-validator.*--rpc-port $RPC_PORT" 2>/dev/null; then
  stopped=1
fi

if [[ $stopped -eq 0 ]]; then
  echo "No local validator found (pid file: $PID_FILE)"
else
  echo "Validator stopped."
fi

if [[ $RESET_LEDGER -eq 1 ]]; then
  rm -rf "$LEDGER_DIR"
  echo "Removed ledger: $LEDGER_DIR"
fi
