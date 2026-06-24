# Operations

Operator runbook for deposit/redemption decoupling and per-pool surplus management.

## Dashboard fields (`GET /v1/vault/assets`)

| Field | Meaning |
|---|---|
| `freeLiquidity` | `token_vault` balance (home vault) |
| `deployedToKamino` | Principal tracked in Kamino (`total_liquidity_in_klend`) |
| `liability` | wStable redemption obligation for this pool |
| `backing` | `freeLiquidity + deployedToKamino` |
| `homeSurplus` | Sweepable home vault excess above liability + cushion |
| `cushion` | `min_liquidity_target` (reserved home balance) |
| `maxRedeemable` | Max wStable burnable from this pool now |

See [Accounting.md](Accounting.md) for formulas.

## Normal operations

1. **Issue path:** User `wrap` → collateral lands in `token_vault`; pool `liability` increases.
2. **Deploy yield:** Admin `deposit_to_klend` (respects cushion). Use `deposit_all_to_klend` to deploy `vault − cushion`.
3. **Harvest:** Admin `harvest_yield` up to Kamino surplus (on-chain enforced).
4. **Treasury exit:** Admin `withdraw_treasury` — never redeployable to Kamino.

## Redemption windows

Before heavy redemptions:

1. Check `GET /v1/quote/redeem` for `canRedeem`, `liquidityShortfall`, `liabilityShortfall`.
2. If `freeLiquidity < expected payout`, call `withdraw_from_klend` or `withdraw_all_from_klend`.
3. Users redeem only up to `maxRedeemable` per pool (liability cap + vault liquidity).

User unwrap never recalls Kamino automatically.

## Emergency recall

1. `withdraw_all_from_klend` per asset → all principal + yield in home vault.
2. `sweep_home_surplus` up to `homeSurplus` → `treasury_vault`.
3. Surplus was never user-redeemable (`unwrap` capped by `liability`).

## Policy controls

- **Stop mint:** `update_asset_policy` → `mint_enabled: false` or `asset_status: RedeemOnly`.
- **Stop redeem:** `redeem_enabled: false` or `asset_status: MintOnly`.
- **Cushion:** set `min_liquidity_target` to reserve home vault on Kamino deploy.

## Monitoring

Run locally or in cron:

```bash
cd wrap-stablecoin && npx ts-node scripts/liquidity_check.ts
```

Exits non-zero when any pool has `freeLiquidity < liabilityUnderlying + cushion` (insufficient home backing for obligations).

## Related

- [Accounting.md](Accounting.md)
- [Redemption.md](Redemption.md)
- [Backend-API.md](Backend-API.md)
