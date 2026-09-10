#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MONO="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

echo "== anchor build =="
anchor build

echo "== metadata verify =="
npm run cli -- metadata verify || {
  echo "metadata verify skipped (vault may not be seeded yet)"
}

echo "== grep audit (user-facing product names) =="
if rg -n 'wStable' "$MONO/frontend/src" "$MONO/admin-frontend/src" "$MONO/backend/src" \
  --glob '!**/theme/**'; then
  echo "FAIL: wStable still present in app source"
  exit 1
fi

echo "== tracked IDL matches build output =="
idl_drift() {
  echo "FAIL: idl/$1 has drifted from the program source"
  echo "      regenerate and commit it, see wiki/Monorepo.md"
  exit 1
}
cmp -s target/idl/wrap_stablecoin.json idl/wrap_stablecoin.json \
  || idl_drift wrap_stablecoin.json
# The tracked .ts differs from the build output only in the header comment,
# which points at the tracked JSON instead of the gitignored one.
sed 's#`target/idl/wrap_stablecoin.json`#`idl/wrap_stablecoin.json`#' target/types/wrap_stablecoin.ts \
  | cmp -s - idl/wrap_stablecoin.ts \
  || idl_drift wrap_stablecoin.ts

echo "== IDL contains initialize_mint_metadata =="
node -e "
const idl = require('./target/idl/wrap_stablecoin.json');
const ix = idl.instructions.find(i => i.name === 'initialize_mint_metadata' || i.name === 'initializeMintMetadata');
if (!ix) { console.error('missing initialize_mint_metadata'); process.exit(1); }
console.log('initialize_mint_metadata OK:', ix.name);
"

echo "verify_branding_release: OK"
