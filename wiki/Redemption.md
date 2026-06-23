# Redemption (`unwrap`)

When a user burns wStable to receive underlying collateral, liquidity comes **only** from the home vault (`token_vault`). Kamino is not part of the user redemption path.

## Flow

```text
unwrap(amount):
  1. Burn wStable; compute out_amount (redemption haircut)
  2. Require token_vault.balance >= out_amount
  3. Transfer out_amount from token_vault → user
```

If `token_vault` does not hold enough free collateral, the instruction fails with `InsufficientLiquidity`. There is no Kamino CPI, no `refresh_reserve`, and no on-chain slippage floor.

## Off-chain quote

Clients should call `GET /v1/quote/redeem?assetMint=&amount=` for the expected `output` (same formula as on-chain) and `freeLiquidity` (current `token_vault` balance). Show a warning when `output > freeLiquidity`.

## Admin vs user paths

| Path | Who | Purpose |
|------|-----|---------|
| `unwrap` | user | Burn wStable; pay from `token_vault` only |
| `withdraw_from_klend` | admin | Move kTokens → home vault without burning wStable |
| `withdraw_all_from_klend` | admin | Recall entire Kamino position to home vault |

Before heavy redemption windows, operators pre-fill `token_vault` via `withdraw_from_klend` or `withdraw_all_from_klend`. Kamino outages affect treasury yield and admin ops, not user unwrap atomicity.

## Related

- [On-chain-program.md](On-chain-program.md)
- [Backend-API.md](Backend-API.md)
