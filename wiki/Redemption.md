# Redemption (`unwrap`)

When a user burns Florin (FLRN) to receive underlying collateral, liquidity comes **only** from the home vault (`token_vault`). Kamino is not part of the user redemption path.

## Flow

```text
unwrap(amount):
  1. Require amount ≤ liability_i (redemption obligation on this pool)
  2. Burn Florin (FLRN); compute out_amount (redemption haircut)
  3. Require token_vault.balance >= out_amount
  4. Transfer out_amount from token_vault → user
```

Redeemability is **liability and liquidity**, not liquidity alone: a pool may hold tokens in `token_vault` and still refuse redemption when `liability_i = 0`. Surplus is admin-extractable via `sweep_home_surplus`, not user-redeemable. See [Accounting.md](Accounting.md) and `wrap-stablecoin/tests/cross_asset.ts`.

If `token_vault` does not hold enough free collateral, the instruction fails with `InsufficientLiquidity`. There is no Kamino CPI, no `refresh_reserve`, and no on-chain slippage floor.

## Off-chain quote

Clients should call `GET /v1/quote/redeem?assetMint=&amount=` for the expected `output` (same formula as on-chain) and `freeLiquidity` (current `token_vault` balance). Show a warning when `output > freeLiquidity`.

## Admin vs user paths

| Path | Who | Purpose |
|------|-----|---------|
| `unwrap` | user | Burn Florin (FLRN); pay from `token_vault` only |
| `withdraw_from_klend` | admin | Move kTokens → home vault without burning Florin (FLRN) |
| `withdraw_all_from_klend` | admin | Recall entire Kamino position to home vault |

Before heavy redemption windows, operators pre-fill `token_vault` via `withdraw_from_klend` or `withdraw_all_from_klend`. Kamino outages affect treasury yield and admin ops, not user unwrap atomicity.

## Related

- [On-chain-program.md](On-chain-program.md)
- [Backend-API.md](Backend-API.md)
