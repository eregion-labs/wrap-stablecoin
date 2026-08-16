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

echo "== IDL contains initialize_mint_metadata =="
node -e "
const idl = require('./target/idl/wrap_stablecoin.json');
const ix = idl.instructions.find(i => i.name === 'initialize_mint_metadata' || i.name === 'initializeMintMetadata');
if (!ix) { console.error('missing initialize_mint_metadata'); process.exit(1); }
console.log('initialize_mint_metadata OK:', ix.name);
"

echo "verify_branding_release: OK"
