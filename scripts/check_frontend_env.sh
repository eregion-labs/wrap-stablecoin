#!/usr/bin/env bash
# Fail if retired frontend env vars (or forbidden process.env reads) reappear.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAILED=0

if ! command -v rg >/dev/null 2>&1; then
  echo "warning: rg not found; skipping env ban checks" >&2
  exit 0
fi

# Retired product env vars (RPC/network/mints) — must come from /v1/client-config.
if rg -n 'NEXT_PUBLIC_(DEFAULT_NETWORK|LOCALNET_RPC|DEVNET_RPC|DEFAULT_ASSET_MINT|SOLANA_NETWORK)' \
  frontend admin-frontend \
  --glob '!**/node_modules/**' \
  --glob '!**/.next/**' \
  --glob '!**/pnpm-lock.yaml' \
  --glob '!**/package-lock.json'; then
  echo "error: retired NEXT_PUBLIC_* env vars found (use NEXT_PUBLIC_BACKEND_URL + /v1/client-config)" >&2
  FAILED=1
fi

# NEXT_PUBLIC_API_BASE is a one-release legacy alias — only allowed in backendUrl.ts
if rg -n 'NEXT_PUBLIC_API_BASE' \
  frontend admin-frontend \
  --glob '!**/node_modules/**' \
  --glob '!**/.next/**' \
  --glob '!**/pnpm-lock.yaml' \
  --glob '!**/package-lock.json' \
  --glob '!**/lib/bootstrap/backendUrl.ts'; then
  echo "error: NEXT_PUBLIC_API_BASE only allowed in lib/bootstrap/backendUrl.ts (prefer NEXT_PUBLIC_BACKEND_URL)" >&2
  FAILED=1
fi

# Deployment process.env reads must live only in bootstrap/backendUrl.ts
if rg -n 'process\.env\.NEXT_PUBLIC_' \
  frontend/src admin-frontend/src \
  --glob '!**/lib/bootstrap/backendUrl.ts' \
  --glob '!**/*.test.*'; then
  echo "error: NEXT_PUBLIC_* process.env reads outside lib/bootstrap/backendUrl.ts" >&2
  FAILED=1
fi

exit "$FAILED"
