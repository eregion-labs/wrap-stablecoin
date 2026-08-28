#!/usr/bin/env bash
# Devnet bootstrap: market + reserve -> vault -> borrower -> full flow test.
# Prerequisites: yarn install, anchor build (for target/idl), funded admin key in .secrets/.
# Usage: ./scripts/devnet/run_devnet_bootstrap.sh [--skip-flow]
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "==> step 1/4: mint + KLend market + reserve"
npx ts-node scripts/devnet/10_setup_market.ts

echo "==> step 2/4: initialize wrap vault"
npx ts-node scripts/devnet/20_setup_vault.ts

echo "==> step 3/4: borrower drives utilization (yield source)"
npx ts-node scripts/devnet/30_borrower.ts

if [[ "${1:-}" == "--skip-flow" ]]; then
    echo "==> skipping flow test"
    exit 0
fi

echo "==> step 4/4: full flow test (wrap -> deposit -> harvest -> withdraw -> unwrap)"
npx ts-node scripts/devnet/40_flow_test.ts
