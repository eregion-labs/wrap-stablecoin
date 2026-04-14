# wStable (Kamino KLend) — `kamino-tester`

Anchor program that mints a single wrapped stablecoin (wStable) **1:1** against the vault’s **base** stablecoin (for example USDC). Deposits are sent to **Kamino KLend** as reserve liquidity; the vault holds **kTokens**. Yield beyond user-backed kTokens can be **harvested** to treasury. **Flash mint** mints wStable in one transaction for repayment plus fee before the transaction ends.

This document matches the **current** program in `src/lib.rs` and instruction account structs.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WRAP (base token only)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User base token ──> token_vault ──> KLend deposit ──> kTokens   │
│       (e.g. USDC)         │              │            (vault)     │
│                           └──────────────────────> mint wStable   │
│                                                    (1:1 amount)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         UNWRAP                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  burn wStable ──> redeem kTokens (proportional) ──> base vault   │
│                         │                                        │
│                         └──> transfer base token ──> user        │
│                         (requested amount; surplus stays as yield)│
└─────────────────────────────────────────────────────────────────┘
```

**Not in user instructions today:** swapping non-base assets (for example USDT → USDC). A Jupiter CPI helper lives under `src/jupiter/`, but **`wrap` / `unwrap` do not invoke Jupiter**; `wrap` requires the base token (`BaseTokenOnly`).

## Features

- **Single wStable mint** per vault (decimals match `base_mint` at `initialize`).
- **KLend** — `deposit_reserve_liquidity` on wrap, `redeem_reserve_collateral` on unwrap and harvest.
- **Token registry** — One `TokenConfig` per mint; extra rows can be registered for future flows; **only the base token can be wrapped** currently.
- **Yield accounting** — `total_collateral_deposited` caps harvest to excess kTokens.
- **Unwrap** — Proportional kToken redemption vs deposits; user receives exactly `amount` base tokens; rounding slack and any extra liquidity remain in the vault as yield.
- **Admin vs authority** — PDAs keyed by immutable `authority`; operational `admin` with two-step transfer.
- **Flash mint** — Optional public use, fee in bps to treasury wStable ATA, per-tx max (`0` = no cap); admin may flash when disabled.

## Program ID

```
5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT
```

## Architecture

### Account structure

```
VaultConfig (PDA: vault_config + authority)
├── authority          — immutable; PDA seed root
├── admin              — signer for gated ix (starts as authority at init)
├── pending_admin      — two-step admin transfer
├── treasury           — pubkey (harvest destination; flash fee ATA owner)
├── wrapped_mint, base_mint, lending_market
├── total_stable_deposited, registered_tokens, paused
└── flash_mint_enabled, flash_mint_fee_bps, flash_mint_max_amount

TokenConfig (PDA: token_config + vault_config + token_mint)
├── reserve, collateral_mint, collateral_vault, token_vault
├── reserve_liquidity_supply  — fixed at add_token for CPI checks
├── total_deposited, total_collateral_deposited
├── is_base_token, enabled
└── bumps

FlashLoanState (PDA: flash_loan + borrower + vault_config)
└── borrower, vault_config, amount, fee
```

### PDAs

| Account | Seeds | Role |
|---------|--------|------|
| `vault_config` | `["vault_config", authority]` | Vault state |
| `vault_authority` | `["vault_authority", vault_config]` | Signs mints, transfers, KLend CPIs |
| `wrapped_mint` | `["wrapped_mint", vault_config]` | wStable mint |
| `token_config` | `["token_config", vault_config, token_mint]` | Per-mint config |
| `token_collateral_vault` | `["token_collateral_vault", token_config]` | kToken ATA |
| `token_vault` | `["token_vault", token_config]` | SPL vault for that mint |
| `flash_loan_state` | `["flash_loan", borrower, vault_config]` | Flash session |

## Data structures

### `VaultConfig`

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump |
| `authority` | `Pubkey` | Immutable creator (seeds) |
| `admin` | `Pubkey` | Operational admin |
| `pending_admin` | `Pubkey` | Pending accept; default = none |
| `treasury` | `Pubkey` | Treasury address |
| `wrapped_mint` | `Pubkey` | wStable mint |
| `wrapped_mint_bump`, `vault_authority_bump` | `u8` | PDAs |
| `lending_market` | `Pubkey` | KLend market |
| `base_mint` | `Pubkey` | Base asset mint |
| `total_stable_deposited` | `u64` | Aggregate wStable liability / deposits |
| `registered_tokens` | `u8` | Number of token rows |
| `paused` | `bool` | Pauses wrap / unwrap / public flash |
| `flash_mint_enabled` | `bool` | Public flash toggle |
| `flash_mint_fee_bps` | `u16` | Fee on principal (max 10000) |
| `flash_mint_max_amount` | `u64` | Per-flash cap; **0 = unlimited** |

### `TokenConfig`

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump |
| `vault_config` | `Pubkey` | Parent |
| `token_mint` | `Pubkey` | SPL mint |
| `token_decimals` | `u8` | Decimals |
| `reserve` | `Pubkey` | KLend reserve |
| `collateral_mint` | `Pubkey` | kToken mint |
| `collateral_vault` | `Pubkey` | kToken ATA |
| `collateral_vault_bump` | `u8` | Bump |
| `token_vault` | `Pubkey` | Token vault for this mint |
| `token_vault_bump` | `u8` | Bump |
| `total_deposited` | `u64` | User-backed base liquidity |
| `is_base_token` | `bool` | Must match `token_mint == base_mint` when true |
| `enabled` | `bool` | If false, wrap fails |
| `reserve_liquidity_supply` | `Pubkey` | Reserve liquidity ATA |
| `total_collateral_deposited` | `u64` | kTokens from tracked wraps |

## Instructions

### `initialize`

Creates `vault_config` and `wrapped_mint`, stores `lending_market`, `treasury`, `base_mint`. Sets `admin` and `authority` to the initializer.

| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Payer; becomes `authority` + initial `admin` |
| `base_mint` | No | No | Base mint |
| `vault_config` | No | Yes | Created |
| `wrapped_mint` | No | Yes | Created |
| `vault_authority` | No | No | PDA |
| `lending_market` | No | No | KLend market |
| `treasury` | No | No | Treasury pubkey |
| `token_program` | No | No | SPL Token |
| `system_program` | No | No | System program |

---

### `add_token`

**Signer:** `admin` (`vault_config.admin`).

**Args:** `is_base_token: bool` — must be true iff `token_mint == vault_config.base_mint`.

| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `admin` | Yes | Yes | Vault admin |
| `vault_config` | No | Yes | Vault |
| `vault_authority` | No | No | PDA |
| `token_mint` | No | No | Mint to register |
| `token_config` | No | Yes | Created |
| `reserve` | No | No | KLend reserve |
| `collateral_mint` | No | No | kToken mint |
| `reserve_liquidity_supply` | No | No | Reserve liquidity ATA (stored on config) |
| `collateral_vault` | No | Yes | Created |
| `token_vault` | No | Yes | Created |
| `token_program` | No | No | SPL Token |
| `collateral_token_program` | No | No | kToken program |
| `system_program` | No | No | System program |

---

### `remove_token`

**Signer:** `admin`. Non-base only; `total_deposited == 0` and vault token balances zero. Closes accounts to admin.

---

### `wrap`

**Base token only.** Args: `WrapArgs { amount: u64 }`.

Transfers `amount` user → `token_vault`, KLend deposit from vault, mints `amount` wStable, updates `total_collateral_deposited` and totals.

| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `user` | Yes | Yes | Depositor |
| `vault_config` | No | Yes | Vault |
| `vault_authority` | No | No | PDA signer for CPI |
| `token_config` | No | Yes | Must be base + enabled |
| `token_mint` | No | No | Matches config |
| `user_token` | No | Yes | User source ATA |
| `user_wrapped` | No | Yes | User wStable ATA |
| `wrapped_mint` | No | Yes | wStable mint |
| `token_vault` | No | Yes | Intermediate vault |
| `base_mint` | No | No | Base mint |
| `klend_program` | No | No | KLend program ID |
| `lending_market` | No | No | Market |
| `lending_market_authority` | No | No | Market authority |
| `base_reserve` | No | Yes | Reserve (from config) |
| `reserve_liquidity_supply` | No | Yes | From config |
| `reserve_collateral_mint` | No | Yes | kToken mint |
| `base_collateral_vault` | No | Yes | kToken vault |
| `token_program` | No | No | SPL Token |
| `collateral_token_program` | No | No | kToken program |
| `instruction_sysvar` | No | No | Instructions sysvar |

**Errors (subset):** `InvalidAmount`, `VaultPaused`, `TokenDisabled`, `BaseTokenOnly`, `InvalidTokenAccount`.

---

### `unwrap`

Args: `UnwrapArgs { amount: u64, min_out_amount: u64 }`. No client-supplied collateral or swap payload; kTokens redeemed are computed on-chain proportionally.

**Errors (subset):** `InvalidAmount`, `InsufficientBalance`, `VaultPaused`, `SlippageExceeded`, `InsufficientLiquidity`, `InvalidTokenAccount`.

Accounts include `base_token_config` (base mint row), `base_token_vault`, `base_collateral_vault`, KLend accounts, sysvar — no Jupiter program or remaining accounts.

---

### `harvest_yield`

**Signer:** `admin`. Args: `HarvestYieldArgs { collateral_amount: u64 }`. Redeems kTokens to `treasury` (address must equal `vault_config.treasury`) capped by excess over `total_collateral_deposited`.

---

### Admin

| Instruction | Notes |
|-------------|--------|
| `set_paused` | Toggle pause |
| `update_treasury` | New treasury pubkey |
| `transfer_authority` | Sets `pending_admin` |
| `accept_authority` | Signer must be `pending_admin`; promotes `admin` |
| `set_flash_mint_fee` | 0–10000 bps |
| `set_flash_mint_enabled` | Public flash toggle |
| `set_flash_mint_max_amount` | Per-tx principal cap; **0 = no limit** |

---

### Flash mint

| Instruction | Notes |
|-------------|--------|
| `flash_mint_start` | Checks later `flash_mint_end` in same tx. Respects `flash_mint_max_amount` when non-zero. Allowed if enabled or `borrower == admin`. |
| `flash_mint_end` | Burns principal; fee in wStable to `fee_receiver` (wStable ATA owned by `treasury`). Closes flash state. |

## External integrations

### KLend

- **Program ID:** `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` (`src/klend/cpi.rs`)
- **CPIs used:** `deposit_reserve_liquidity`, `redeem_reserve_collateral`

### Jupiter

`src/jupiter/` provides a swap CPI helper; **no instruction in `lib.rs` calls it** for wrap/unwrap.

## Error codes

Numeric codes are assigned by Anchor from `src/errors.rs`; use the generated IDL for exact values. Names include:

`VaultPaused`, `InsufficientBalance`, `NoYieldAvailable`, `Unauthorized`, `MathOverflow`, `InvalidAmount`, `BaseTokenOnly`, `InsufficientLiquidity`, `FlashMintDisabled`, `MissingFlashMintEnd`, `InvalidFlashLoan`, `InsufficientRepayment`, `InvalidFlashMintFee`, `TokenDisabled`, `TokenHasDeposits`, `CannotRemoveBaseToken`, `TokenAlreadyRegistered`, `MaxTokensReached`, `SlippageExceeded`, `SwapFailed`, `TokenNotFound`, `InvalidTokenAccount`, `InvalidBaseTokenConfig`, `ExceedsHarvestableYield`, `FlashMintAmountExceeded`, `NoPendingTransfer`

## Usage examples (TypeScript)

```typescript
await program.methods.initialize().accounts({
  authority: wallet.publicKey,
  baseMint: BASE_MINT,
  lendingMarket: LENDING_MARKET,
  treasury: treasuryPubkey,
  tokenProgram: TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
}).rpc();

await program.methods.addToken(true).accounts({
  admin: wallet.publicKey,
  tokenMint: BASE_MINT,
  reserve: RESERVE,
  collateralMint: KTOKEN_MINT,
  reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
  tokenProgram: TOKEN_PROGRAM_ID,
  collateralTokenProgram: COLLATERAL_TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
}).rpc();

await program.methods
  .wrap({ amount: new anchor.BN(1_000_000) })
  .accounts({
    user: wallet.publicKey,
    tokenConfig: baseTokenConfigPda,
    // tokenMint, vaults, mints, KLend accounts, instructionSysvar, ...
  })
  .rpc();

await program.methods
  .unwrap({
    amount: new anchor.BN(1_000_000),
    minOutAmount: new anchor.BN(990_000),
  })
  .accounts({
    user: wallet.publicKey,
    baseTokenConfig: baseTokenConfigPda,
    // user ATAs, KLend accounts, instructionSysvar, ...
  })
  .rpc();
```

## Building and testing

```bash
anchor build
anchor test
```

## Security considerations

1. **PDA authority** — Vault PDA signs KLend and token CPIs.
2. **Immutable `authority`** — Seeds do not move with admin rotation.
3. **Two-step admin transfer** — Reduces mistaken handover.
4. **Proportional unwrap** — Limits griefing via small burns and large redemptions.
5. **Harvest cap** — Only kTokens above `total_collateral_deposited` are harvestable as yield.
6. **Flash mint** — Requires `flash_mint_end` later in the same transaction; optional max size; fee to treasury-controlled wStable ATA.
7. **User ATA checks** — `wrap` / `unwrap` validate mint and owner from raw token account data.
