#!/usr/bin/env bash
# One-shot local development bootstrap (opinions-market style).
#
#   1. Kill any prior validator (pkill)
#   2. Fetch KLend bytecode (if missing) + anchor build
#   3. Start solana-test-validator in background (&) — logs in this terminal tab
#   4. Seed vault (initialize → add_asset → enable_klend)
#   5. Print env snippets for backend / frontend
#
# The validator keeps running after this script exits. Leave this terminal open
# to see slot/processed logs. Stop with: anchor run local-stop
#
# Usage: from wrap-stablecoin/ :  anchor run local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=local_env.sh
source "$ROOT/scripts/local_env.sh"

print_deploy_banner() {
  cat <<'EOF'
⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
⭐⭐                                    ⭐⭐
⭐⭐     MIRACLE: MACHINE DEPLOYED      ⭐⭐
⭐⭐                                    ⭐⭐
⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐
EOF
}

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export CLUSTER=localnet
ANCHOR_WALLET_PATH="${ANCHOR_WALLET_PATH:-.secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json}"
export ANCHOR_WALLET="$ANCHOR_WALLET_PATH"

echo "═══ Phase A: env ═══"
echo "RPC_URL=$RPC_URL"
echo "ANCHOR_WALLET=$ANCHOR_WALLET_PATH"

echo ""
echo "═══ Phase B: stop prior validator + fetch KLend + build ═══"
local_env_kill_prior_validators
bash "$ROOT/scripts/local_stop.sh" 2>/dev/null || true
bash "$ROOT/scripts/fetch_klend_so.sh"
anchor keys sync 2>/dev/null || true
anchor build
local_env_resolve_program_id
echo "PROGRAM_ID=$PROGRAM_ID"

echo ""
echo "═══ Phase C: start validator (background, logs in this terminal) ═══"
local_env_start_validator --reset
sleep 3
local_env_wait_for_rpc 90

if solana account "$PROGRAM_ID" --url "$RPC_URL" >/dev/null 2>&1; then
  echo "wrap_stablecoin loaded at $PROGRAM_ID"
else
  echo "warning: could not verify program account $PROGRAM_ID on $RPC_URL" >&2
fi

echo ""
echo "═══ Phase D: seed vault ═══"
ANCHOR_PROVIDER_URL="$RPC_URL" \
ANCHOR_WALLET="$ANCHOR_WALLET_PATH" \
  yarn ts-node scripts/seed_localnet.ts

echo ""
print_deploy_banner
echo "Validator still running on $RPC_URL (pid $(cat "$PID_FILE"), background job in this shell)."
echo "Slot/processed logs continue in this tab while it stays open."
echo "Stop: anchor run stop-local   or   kill -9 \$(lsof -ti:$RPC_PORT)"
echo "Ledger: $LEDGER_DIR"
