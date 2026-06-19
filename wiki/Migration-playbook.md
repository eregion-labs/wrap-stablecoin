# USDC → Stable migration playbook

This document describes how to migrate wStable reserves using **policy toggles** and **treasury market operations**. There is **no** on-chain admin reserve migration instruction.

## Principles

- **Change reserves, not the money** — wStable mint address and user balances stay fixed.
- **Treasury uses the same paths as users** — `wrap` / `unwrap` only.
- **Anti-reflexivity** — Stable may back wStable; wStable must never back Stable.

## Phases

| Phase | USDC mint | Stable mint | USDC redeem | Stable redeem | Notes |
|-------|-----------|-------------|-------------|---------------|-------|
| 1 | ON | OFF | ON | OFF | Launch (current) |
| 2 | ON | ON | ON | ON | Dual collateral |
| 3 | OFF | ON | ON | ON | Stop new USDC backing |
| 4 | OFF | ON | ON | ON | USDC pool drains via users + treasury |
| 5 | OFF | ON | OFF | ON | USDC fully deprecated |

Use `update_asset_policy` to set `mint_enabled`, `redeem_enabled`, and `asset_status` (`MintOnly`, `RedeemOnly`, `Deprecated`).

## Treasury migration loop

```
Treasury cash
  → buy wStable (DEX)
  → unwrap(asset=USDC)
  → buy Stable (DEX)
  → wrap(asset=Stable)
```

Repeat until USDC `net_liability` and free vault balance are near zero.

## Liquidity operations

- Monitor `GET /v1/vault/assets` for per-pool free liquidity and Kamino deployment.
- Before heavy redemption windows, admin `withdraw_from_klend` on the target asset to refill `token_vault` (asset must have `enable_klend` already).
- Avoid new `deposit_to_klend` on an asset when you need to keep more free liquidity for redemptions.

## Risk controls during migration

- Set `mint_cap` / `exposure_cap` on Stable when first enabling dual collateral.
- Use `mint_haircut_bps` on any asset showing depeg risk.
- Use `redemption_haircut_bps` only with care — pair with mint policy to avoid arbitrage.
- Cap Stable exposure as a fraction of total wStable supply until Stable has independent external reserves.

## Program upgrade (existing vault)

1. Deploy upgraded `wrap_stablecoin` program (preserve program id if upgradeable).
2. Re-bootstrap or migrate accounts: `initialize` → `add_asset` per collateral → `enable_klend` where Kamino is used.
3. `add_asset` for additional collateral; `enable_klend` when a Kamino market is available.
4. Update backend `DEFAULT_ASSET_MINT` and frontend asset picker.

## What we explicitly do not do

- `admin_move_USDC_to_Stable` or OTC pool injection without minting/burning wStable
- Basket redemption (always exactly one asset per `unwrap`)
