# Shared constants for localnet scripts. Source from wrap-stablecoin/ root:
#   source scripts/local_env.sh

if [[ -n "${LOCAL_ENV_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
LOCAL_ENV_LOADED=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

KLEND_PROGRAM_ID="KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
FIXTURE_WALLET_PUBKEY="5s72BFe78FWbXRzPHGoq7p8J6Ky2qWWDf4Nmk5aWWxtU"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Resolved from target/deploy/wrap_stablecoin-keypair.json after `anchor build`.
PROGRAM_ID="${PROGRAM_ID:-}"

local_env_resolve_program_id() {
  local kp="$ROOT/target/deploy/wrap_stablecoin-keypair.json"
  if [[ ! -f "$kp" ]]; then
    echo "missing program keypair: $kp (run anchor build)" >&2
    return 1
  fi
  PROGRAM_ID="$(solana address -k "$kp")"
}

RPC_PORT="${RPC_PORT:-8901}"
RPC_URL="http://127.0.0.1:${RPC_PORT}"

LEDGER_DIR="${LEDGER_DIR:-/tmp/wrap-stablecoin-ledger}"
LOG_DIR="${LOG_DIR:-/tmp/localnet-logs}"
LOCALNET_DIR="${LOCALNET_DIR:-$ROOT/.localnet}"
VALIDATOR_LOG="${VALIDATOR_LOG:-$LOG_DIR/validator.log}"
PID_FILE="${PID_FILE:-$LOCALNET_DIR/validator.pid}"

SLOT_FILE="$ROOT/fixtures/klend/slot.txt"
if [[ -f "$SLOT_FILE" ]]; then
  WARP_SLOT="$(tr -d '[:space:]' <"$SLOT_FILE")"
else
  WARP_SLOT="${WARP_SLOT:-413424802}"
fi

REQUIRED_FILES=(
  "so/klend.so"
  "target/deploy/wrap_stablecoin.so"
  "fixtures/klend/lending_market.json"
  "fixtures/klend/reserve.json"
  "fixtures/klend/reserve_liquidity_supply.json"
  "fixtures/klend/reserve_collateral_mint.json"
  "fixtures/klend/reserve_fee_vault.json"
  "fixtures/klend/liquidity_mint_usdc.json"
  "fixtures/klend/scope_prices.json"
  "fixtures/user/wallet_account.json"
  "fixtures/user/usdc_ata.json"
  "fixtures/user/wallet.json"
)

local_env_check_files() {
  local missing=0
  for f in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$ROOT/$f" ]]; then
      echo "missing: $f" >&2
      missing=1
    fi
  done
  if [[ $missing -ne 0 ]]; then
    echo "Run: yarn fetch-klend-so && anchor build" >&2
    echo "If KLend fixtures are stale: yarn dump-klend && yarn make-user-fixture" >&2
    return 1
  fi
}

# Start validator in background (&). Sets VALIDATOR_PID.
#
# Default (anchor run local): no --quiet, logs to the terminal tab that ran the
# script — opinions-market style. Validator survives script exit; keep that tab open.
#
# Set LOCAL_VALIDATOR_LOG_TO_FILE=1 for quiet + log file (smoke/CI).
local_env_start_validator() {
  local reset_flag="${1:---reset}"
  local_env_resolve_program_id
  mkdir -p "$LOG_DIR" "$LOCALNET_DIR"
  rm -rf "$LEDGER_DIR"

  local -a validator_args=(
    "$reset_flag"
    --ledger "$LEDGER_DIR"
    --rpc-port "$RPC_PORT"
    --bind-address 127.0.0.1
    --gossip-port "$((RPC_PORT + 3))"
    --faucet-port "$((RPC_PORT + 4))"
    --warp-slot "$WARP_SLOT"
    --bpf-program "$KLEND_PROGRAM_ID" "$ROOT/so/klend.so"
    --bpf-program "$PROGRAM_ID" "$ROOT/target/deploy/wrap_stablecoin.so"
    --account 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF "$ROOT/fixtures/klend/lending_market.json"
    --account D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59 "$ROOT/fixtures/klend/reserve.json"
    --account Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6 "$ROOT/fixtures/klend/reserve_liquidity_supply.json"
    --account B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D "$ROOT/fixtures/klend/reserve_collateral_mint.json"
    --account BbDUrk1bVtSixgQsPLBJFZEF7mwGstnD5joA1WzYvYFX "$ROOT/fixtures/klend/reserve_fee_vault.json"
    --account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v "$ROOT/fixtures/klend/liquidity_mint_usdc.json"
    --account 3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH "$ROOT/fixtures/klend/scope_prices.json"
    --account 5s72BFe78FWbXRzPHGoq7p8J6Ky2qWWDf4Nmk5aWWxtU "$ROOT/fixtures/user/wallet_account.json"
    --account Fs2pMyCiKAfnhG6ucMLWSW945UrUkfcLP5UFsASKbbK1 "$ROOT/fixtures/user/usdc_ata.json"
  )

  if [[ "${LOCAL_VALIDATOR_LOG_TO_FILE:-0}" == "1" ]]; then
    validator_args=(--quiet "${validator_args[@]}")
    solana-test-validator "${validator_args[@]}" >"$VALIDATOR_LOG" 2>&1 &
  else
    solana-test-validator "${validator_args[@]}" &
  fi

  VALIDATOR_PID=$!
  echo "$VALIDATOR_PID" >"$PID_FILE"
}

local_env_wait_for_rpc() {
  local max_wait="${1:-90}"
  local i
  for ((i = 1; i <= max_wait; i++)); do
    if solana cluster-version -u "$RPC_URL" >/dev/null 2>&1; then
      echo "validator RPC ready (after ${i}s)"
      return 0
    fi
    sleep 1
    if [[ -n "${VALIDATOR_PID:-}" ]] && ! kill -0 "$VALIDATOR_PID" 2>/dev/null; then
      echo "validator died (pid $VALIDATOR_PID)" >&2
      if [[ "${LOCAL_VALIDATOR_LOG_TO_FILE:-0}" == "1" && -f "$VALIDATOR_LOG" ]]; then
        echo "last 40 lines of $VALIDATOR_LOG:" >&2
        tail -40 "$VALIDATOR_LOG" >&2
      fi
      return 1
    fi
  done
  echo "validator did not start within ${max_wait}s" >&2
  if [[ "${LOCAL_VALIDATOR_LOG_TO_FILE:-0}" == "1" && -f "$VALIDATOR_LOG" ]]; then
    tail -40 "$VALIDATOR_LOG" >&2
  fi
  return 1
}

local_env_kill_prior_validators() {
  pkill solana-test-validator 2>/dev/null || true
}
