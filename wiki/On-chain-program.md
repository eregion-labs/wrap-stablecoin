# On-chain program

Anchor program: **`wrap_stablecoin`**

- Source: `wrap-stablecoin/programs/wrap-stablecoin/src/`
- Program ID: `5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT`

## User instructions

| Instruction | Description |
|-------------|-------------|
| `wrap` | Transfer USDC to `token_vault`, mint wStable 1:1 (on actual received amount) |
| `unwrap` | Burn wStable, transfer USDC from `token_vault` to user |

Gated by `paused`, `wrap_public` / `unwrap_public`, and optional allowlist.

## Admin — liquidity

| Instruction | Description |
|-------------|-------------|
| `deposit_to_klend` | Move USDC from `token_vault` into KLend; receive kTokens in `collateral_vault` |
| `withdraw_from_klend` | Redeem kTokens for USDC back into `token_vault` |
| `harvest_yield` | Redeem kTokens to `treasury`; enforces residual-backing invariant |

## Admin — policy

| Instruction | Description |
|-------------|-------------|
| `initialize` | One-shot vault bootstrap (no add/remove token) |
| `set_paused` | Emergency pause |
| `set_wrap_public` / `set_unwrap_public` | Public access toggles |
| `init_allowlist` / `add_to_allowlist` / `remove_from_allowlist` | Allowlist (max 64 entries) |
| `update_treasury` | Set USDC treasury ATA |
| `transfer_authority` / `cancel_transfer_authority` / `accept_authority` | Two-step admin rotation |
| `set_flash_mint_*` | Flash-mint enable, fee bps, max amount, fee receiver |

## Flash mint

| Instruction | Description |
|-------------|-------------|
| `flash_mint_start` | Mint wStable if matching `flash_mint_end` found in same tx |
| `flash_mint_end` | Burn principal, transfer fee to `flash_mint_fee_receiver`, close PDA |

## State accounts

- **VaultConfig** — authority, admin, mints, KLend market, totals, flags
- **TokenConfig** — base USDC reserve linkage, vaults, `total_deposited`, `total_liquidity_in_klend`
- **Allowlist** — optional pubkey gate
- **FlashLoanState** — ephemeral per flash borrow

## Build & test

```bash
cd wrap-stablecoin
anchor build
anchor test
```

See [Architecture](Architecture) for flows, PDAs, and security model.
