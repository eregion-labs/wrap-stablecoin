# Per-asset accounting

wStable is fungible globally, but each collateral asset has its own **mini balance sheet**. The protocol does not track where a unit of wStable was originally minted.

## Liability (redemption obligation)

For each asset pool `i`:

```text
liability_i = total_wrapped_minted_i − total_redemptions_i   (wStable atoms)
```

This is the amount of wStable that can still be redeemed **through pool `i`**.

| Event | Pool effect |
|---|---|
| `wrap` via pool `i` | `token_vault_i += deposit`; `liability_i += wStable_minted` |
| `unwrap` from pool `j` | `token_vault_j -= payout`; `liability_j -= wStable_burned` |

Cross-asset: redeeming via USDT only updates USDT counters, not the pool where wStable was minted.

On-chain fields: `AssetConfig.total_wrapped_minted`, `AssetConfig.total_redemptions`. Global fungible supply: `VaultConfig.total_stable_deposited`.

## Backing and surplus

Assume 1:1 stable value between registered collaterals and wStable (modulo per-asset haircuts on wrap/unwrap).

```text
backing_i   = token_vault_i + kamino_value_i
surplus_i   = backing_i − liability_i   (conceptual; see extraction paths below)
cushion_i   = min_liquidity_target_i      (underlying atoms; operator reserve)
```

After emergency recall (`withdraw_all_from_klend`): `kamino_value_i = 0`, yield sits in `token_vault_i`.

## User redemption limits

Redeemability requires **both** gates (not liquidity alone):

```text
maxRedeemable_i = min(liability_i, liquidity_i)
```

Where `liquidity_i` is the home vault balance converted to wStable atoms (1:1 at matching decimals, before redemption haircut).

| Gate | On-chain check | Error |
|---|---|---|
| Liability | `amount ≤ net_liability()` | `InsufficientLiability` |
| Liquidity | `payout ≤ token_vault_i` | `InsufficientLiquidity` |

`unwrap` from pool `i` also requires:

1. `redeem_enabled` and allowed `asset_status`
2. Global wStable balance (`InsufficientBalance` if user or vault supply insufficient)

Surplus (`token_vault_i > liability` in underlying terms) is **not** user-redeemable. Reference proof: `wrap-stablecoin/tests/cross_asset.ts` (CCC / TTT vault-only pools).

## Surplus extraction

| Regime | Formula | Instruction |
|---|---|---|
| Kamino deployed | `kamino_surplus_i = max(0, kamino_value_i − total_liquidity_in_klend_i)` | `harvest_yield` → `treasury_vault` |
| Post-recall / home | `home_surplus_i = max(0, token_vault_i − liability_underlying_i − cushion_i)` | `sweep_home_surplus` → `treasury_vault` |
| Treasury exit | — | `withdraw_treasury` |

Treasury tokens are never redeployed to Kamino (`deposit_to_klend` sources `token_vault` only).

## Example

Issue 1M USDT → `liability = 1M`, `token_vault += 1M`.

After recall, `token_vault = 1.1M`, `liability = 1M`, `cushion = 0`:

```text
home_surplus = 100k  →  sweep_home_surplus
```

User with 1.1M wStable can redeem at most **1M** from USDT (`liability` cap); 100k must use another pool with capacity. After 1M redeemed: `token_vault = 100k`, `liability = 0` — remaining 100k is fully sweepable.

## Related

- [On-chain-program.md](On-chain-program.md)
- [Redemption.md](Redemption.md)
- [Operations.md](Operations.md)
