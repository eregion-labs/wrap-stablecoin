# wStable (Kamino KLend) — `kamino-tester`

Anchor program that mints a single wrapped stablecoin (wStable) 1:1 against the vault’s **base** stablecoin (for example USDC). User deposits are moved into **Kamino KLend** as reserve liquidity; the vault holds **kTokens** as collateral. Yield that accrues beyond user-backed kTokens can be **harvested** to a treasury. **Flash mint** lets a borrower mint wStable in one transaction and repay principal plus fee before the transaction ends.

This README reflects the **current on-chain behavior** in `src/lib.rs` and the instruction account structs.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         WRAP (base token only)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User base token ──> token_vault ──> KLend deposit ──> kTokens   │
│       (e.g. USDC)         │              │            (vault)    │
│                           └──────────────────────> mint wStable  │
│                                                    (1:1 amount)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                              UNWRAP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  burn wStable ──> redeem kTokens (proportional) ──> base vault   │
│                         │                                        │
│                         └──> transfer base token ──> user        │
│                         (requested amount; extra stays as yield) │
└─────────────────────────────────────────────────────────────────┘
```

**Not implemented in instructions today:** swapping non-base stables into the base asset (for example USDT → USDC). The crate includes a Jupiter CPI helper under `src/jupiter/`, but **`wrap` and `unwrap` do not call Jupiter**; `wrap` requires the **base** token config (`BaseTokenOnly`).

## Features

- **Single wStable mint** per vault, decimals aligned with `base_mint` at `initialize`.
- **KLend integration** — `deposit_reserve_liquidity` on wrap, `redeem_reserve_collateral` on unwrap and harvest.
- **Per-token registry** — `TokenConfig` per mint (reserve, vaults, bookkeeping). Additional tokens can be registered for future use; **only the base token can be wrapped** in the current program.
- **Yield accounting** — `total_collateral_deposited` tracks kTokens backing user flows; harvest is capped to **excess** kTokens above that baseline.
- **Unwrap safety** — kTokens redeemed are computed **proportionally** from the user’s burn amount so a small burn cannot drain all collateral.
- **Admin vs authority** — PDAs are seeded by immutable `authority`; day-to-day admin is `admin` (two-step transfer).
- **Flash mint** — Optional public flash mint, fee in bps to treasury wStable ATA, per-tx max amount (0 = no limit), admin can flash when disabled.

## Program ID

```
5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT
```

## Architecture

### Account structure

```
VaultConfig (PDA: vault_config + authority pubkey)
├── authority          — immutable; used in PDA seeds
├── admin              — operational admin (starts as authority)
├── pending_admin      — two-step admin transfer
├── treasury           — pubkey (fee receiver / harvest destination)
├── wrapped_mint, base_mint, lending_market
├── totals, pause, flash-mint settings
└── registered_tokens: u8

TokenConfig (PDA: token_config + vault_config + token_mint)
├── reserve, collateral_mint, collateral_vault, token_vault
├── reserve_liquidity_supply  — pinned for CPI account checks
├── total_deposited           — base liquidity accounted to users
├── total_collateral_deposited — kTokens attributed to user wrap flow
├── is_base_token, enabled
└── bumps

FlashLoanState (PDA: flash_loan + borrower + vault_config)
├── borrower, vault_config, amount, fee
└── created on flash_mint_start, closed on flash_mint_end
```

### PDAs

| Account | Seeds | Role |
|---------|--------|------|
| `vault_config` | `["vault_config", authority]` | Vault state |
| `vault_authority` | `["vault_authority", vault_config]` | Signs mints, transfers, KLend CPIs |
| `wrapped_mint` | `["wrapped_mint", vault_config]` | wStable mint |
| `token_config` | `["token_config", vault_config, token_mint]` | Per-mint config |
| `token_collateral_vault` | `["token_collateral_vault", token_config]` | kToken ATA |
| `token_vault` | `["token_vault", token_config]` | SPL vault for that mint (wrap pulls base here first) |
| `flash_loan_state` | `["flash_loan", borrower, vault_config]` | Flash mint session |

## Data structures

### `VaultConfig`

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump |
| `authority` | `Pubkey` | Immutable creator key (PDA seeds) |
| `admin` | `Pubkey` | Admin signer for gated instructions |
| `pending_admin` | `Pubkey` | Pending accept; default = none |
| `treasury` | `Pubkey` | Treasury pubkey (flash fee ATA owner must match; harvest account address) |
| `wrapped_mint` | `Pubkey` | wStable mint |
| `wrapped_mint_bump`, `vault_authority_bump` | `u8` | PDAs |
| `lending_market` | `Pubkey` | KLend market |
| `base_mint` | `Pubkey` | Accounting / unwrap asset |
| `total_stable_deposited` | `u64` | Aggregate wrapped liability |
| `registered_tokens` | `u8` | Count of `TokenConfig` rows |
| `paused` | `bool` | Blocks wrap / unwrap / public flash |
| `flash_mint_enabled` | `bool` | Public flash mint toggle |
| `flash_mint_fee_bps` | `u16` | Fee on principal, max 10000 |
| `flash_mint_max_amount` | `u64` | Max principal per flash; **0 = unlimited** |

### `TokenConfig`

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump |
| `vault_config` | `Pubkey` | Parent |
| `token_mint` | `Pubkey` | SPL mint for this row |
| `token_decimals` | `u8` | Decimals |
| `reserve` | `Pubkey` | KLend reserve |
| `collateral_mint` | `Pubkey` | kToken mint |
| `collateral_vault` | `Pubkey` | Vault kToken ATA |
| `collateral_vault_bump` | `u8` | Bump |
| `token_vault` | `Pubkey` | SPL token vault for this mint |
| `token_vault_bump` | `u8` | Bump |
| `total_deposited` | `u64` | User-backed base amount via this token |
| `is_base_token` | `bool` | Must match `token_mint == base_mint` when true |
| `enabled` | `bool` | If false, wrap fails for this config |
| `reserve_liquidity_supply` | `Pubkey` | KLend reserve liquidity ATA |
| `total_collateral_deposited` | `u64` | kTokens minted into vault from tracked wraps |

### `FlashLoanState`

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump |
| `borrower` | `Pubkey` | Flash borrower |
| `vault_config` | `Pubkey` | Vault |
| `amount` | `u64` | Principal minted |
| `fee` | `u64` | Fee owed in wStable |

## Instructions

### `initialize`

Creates `vault_config`, `wrapped_mint`, and records `lending_market`, `treasury`, `base_mint`. Sets `admin` and `authority` to the initializer.

**Signers / accounts:** `authority` (payer), `base_mint`, `vault_config`, `wrapped_mint`, `vault_authority`, `lending_market`, `treasury`, token program, system program.

---

### `add_token`

Registers a token row. **Constraints:** `is_base_token` must be true iff `token_mint == vault_config.base_mint`. Stores `reserve_liquidity_supply` for later CPI validation.

**Args:** `is_base_token: bool`

**Signers:** `admin` (must match `vault_config.admin`)

**Accounts:** `vault_config`, `vault_authority`, `token_mint`, `token_config` (init), `reserve`, `collateral_mint`, `reserve_liquidity_supply`, `collateral_vault` (init), `token_vault` (init), token programs, system program.

---

### `remove_token`

Removes a **non-base** token with **zero** `total_deposited`, **zero** vault balances, closes vaults to admin, closes `token_config` to admin.

**Signers:** `admin`

---

### `wrap`

**Base token only.** Transfers `amount` from user → `token_vault`, CPI deposit into KLend from that vault, updates `total_collateral_deposited`, mints **the same `amount`** of wStable to the user, updates totals.

**Args:** `WrapArgs { amount: u64 }`

**Notable accounts:** `user`, `vault_config`, `vault_authority`, `token_config` (must be base + enabled), mints/vaults, KLend accounts, `instruction_sysvar`.

**Errors:** `InvalidAmount`, `VaultPaused`, `TokenDisabled`, `BaseTokenOnly`, `InvalidTokenAccount`, math errors.

---

### `unwrap`

Burns `amount` wStable, redeems kTokens **proportionally** to `amount` vs `base_token_config.total_deposited` (with a +1 rounding buffer), requires redeemed liquidity ≥ `amount` and ≥ `min_out_amount`, transfers **exactly `amount`** base tokens to the user; any surplus remains in `base_token_vault` as yield.

**Args:** `UnwrapArgs { amount: u64, min_out_amount: u64 }`

**Errors:** `InvalidAmount`, `InsufficientBalance`, `VaultPaused`, `SlippageExceeded`, `InsufficientLiquidity`, `InvalidTokenAccount`, math errors.

---

### `harvest_yield`

Admin redeems `collateral_amount` kTokens from a token’s `collateral_vault` into `treasury`, capped so only **yield** is taken: `collateral_amount ≤ collateral_vault_balance - token_config.total_collateral_deposited`.

**Args:** `HarvestYieldArgs { collateral_amount: u64 }`

**Signers:** `admin`

**Accounts:** `vault_config`, `vault_authority`, `token_config`, `token_mint`, `treasury` (**must** match `vault_config.treasury`), KLend accounts, sysvar.

---

### Admin

| Instruction | Behavior |
|-------------|----------|
| `set_paused(paused)` | Toggle pause |
| `update_treasury` | Set `treasury` to `new_treasury` |
| `transfer_authority` | Set `pending_admin` to `new_admin` |
| `accept_authority` | **Signer** `new_admin` must equal `pending_admin`; promotes `admin`, clears pending |
| `set_flash_mint_fee(fee_bps)` | 0–10000 |
| `set_flash_mint_enabled(enabled)` | Public flash toggle |
| `set_flash_mint_max_amount(max_amount)` | Per-tx cap; **0 disables the cap** |

All gated admin instructions use **`vault_config.admin`** (not `authority`).

---

### Flash mint

| Instruction | Behavior |
|-------------|----------|
| `flash_mint_start(args)` | If `flash_mint_max_amount > 0`, `args.amount` must not exceed it. Requires a later `flash_mint_end` in the same tx (sysvar scan). Mints `amount` wStable to borrower. Allowed if `flash_mint_enabled` **or** `borrower == admin`. |
| `flash_mint_end` | Burns principal from borrower; transfers **fee** in wStable to `fee_receiver` (must be wStable ATA owned by `vault_config.treasury`). Closes `flash_loan_state` to borrower. |

## External integrations

### KLend

- **Program ID (in code):** `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` (`src/klend/`)
- Used instructions: **`deposit_reserve_liquidity`**, **`redeem_reserve_collateral`**

### Jupiter

Helper module **`src/jupiter/`** (CPI with client-supplied ix data) is present for potential swaps; **no program instruction currently invokes it** for wrap/unwrap.

## Error codes (names)

Anchor assigns numeric codes at build time; refer to the IDL or `errors::ErrorCode` for numbers. Logical names include:

`VaultPaused`, `InsufficientBalance`, `NoYieldAvailable`, `Unauthorized`, `MathOverflow`, `InvalidAmount`, `BaseTokenOnly`, `InsufficientLiquidity`, `FlashMintDisabled`, `MissingFlashMintEnd`, `InvalidFlashLoan`, `InsufficientRepayment`, `InvalidFlashMintFee`, `TokenDisabled`, `TokenHasDeposits`, `CannotRemoveBaseToken`, `TokenAlreadyRegistered`, `MaxTokensReached`, `SlippageExceeded`, `SwapFailed`, `TokenNotFound`, `InvalidTokenAccount`, `InvalidBaseTokenConfig`, `ExceedsHarvestableYield`, `FlashMintAmountExceeded`, `NoPendingTransfer`

## Usage sketch (TypeScript)

Adjust PDAs and cluster constants to your deployment.

```typescript
// Initialize
await program.methods
  .initialize()
  .accounts({
    authority: wallet.publicKey,
    baseMint: BASE_MINT,
    lendingMarket: LENDING_MARKET,
    treasury: treasuryPubkey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// Add base token (USDC)
await program.methods
  .addToken(true)
  .accounts({
    admin: wallet.publicKey,
    tokenMint: BASE_MINT,
    reserve: RESERVE,
    collateralMint: KTOKEN_MINT,
    reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
    tokenProgram: TOKEN_PROGRAM_ID,
    collateralTokenProgram: COLLATERAL_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// Wrap (base only)
await program.methods
  .wrap({ amount: new anchor.BN(1_000_000) })
  .accounts({
    user: wallet.publicKey,
    tokenConfig: baseTokenConfigPda,
    // ... token_mint, vaults, KLend accounts, sysvar
  })
  .rpc();

// Unwrap
await program.methods
  .unwrap({
    amount: new anchor.BN(1_000_000),
    minOutAmount: new anchor.BN(990_000),
  })
  .accounts({
    user: wallet.publicKey,
    baseTokenConfig: baseTokenConfigPda,
    // ... user ATAs, KLend accounts, sysvar
  })
  .rpc();
```

## Build and test

From the repo root (see root `AGENTS.md`):

```bash
anchor build
anchor test
```

## Security notes

1. **Immutable `authority`** — PDAs never migrate with admin; new vault = new addresses if you need a different seed root.
2. **Two-step admin** — Reduces mistaken single-sig transfers.
3. **Proportional unwrap** — Mitigates collateral-draining griefing.
4. **Harvest cap** — Prevents redeeming user-backed kTokens via `harvest_yield`.
5. **Flash mint** — Transaction must include `flash_mint_end`; optional max amount; fee to treasury-controlled wStable ATA.
6. **User token checks** — `wrap` / `unwrap` validate mint and owner on supplied ATAs from raw account data.
