#!/usr/bin/env bash
# Download mainnet KLend program bytecode for local test-validator preload.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=local_env.sh
source "$ROOT/scripts/local_env.sh"

OUT="$ROOT/so/klend.so"
mkdir -p "$ROOT/so"

if [[ -f "$OUT" && "${FORCE_KLEND_FETCH:-0}" != "1" ]]; then
  echo "klend.so already exists at $OUT (set FORCE_KLEND_FETCH=1 to re-fetch)"
  exit 0
fi

echo "Fetching KLend program from mainnet-beta → $OUT"
solana program dump -u mainnet-beta "$KLEND_PROGRAM_ID" "$OUT"
echo "Done."
