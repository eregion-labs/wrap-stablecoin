# Olympus Complex — Architecture & Design Philosophy

## Purpose

Olympus Complex is a Solana protocol that issues **yield-bearing wrapped stablecoins (wStable)** backed by one or more base stablecoins (e.g., USDC). Users deposit stablecoins and receive wStable tokens 1:1; underlying assets are deposited into **Kamino KLend** to earn yield. The protocol unifies multiple stablecoins into a single wrapped token, routes non-base tokens through **Jupiter** for swaps, and supports **flash mint** for uncollateralized, same-transaction borrowing.

**Core value proposition:** Hold a single wStable token that accrues yield from lending markets while supporting multiple input stablecoins and enabling flash-loan-style arbitrage.

---

## Design Philosophy

### 1. **Composability Over Isolation**

The protocol is built to integrate with existing Solana DeFi primitives rather than reimplement them:

- **KLend** — All stablecoin deposits are lent via KLend; the protocol does not run its own lending logic.
- **Jupiter** — Non-base tokens (USDT, etc.) are swapped to the base token via Jupiter; no built-in AMM.
- **SPL Token** — Standard token interfaces for mints and accounts.

The design favors **CPI (Cross-Program Invocation)** into battle-tested programs instead of custom logic.

### 2. **Single Wrapped Token, Multiple Inputs**

One wStable mint represents the unified vault. Users can wrap USDC directly or wrap USDT (and other stablecoins) after an automatic swap to the base token. This reduces fragmentation: one token for users to hold and integrate with, while the vault manages multiple reserves and swap routes.

### 3. **Authority-Centric Configuration**

Each vault is tied to an **authority** (admin). PDAs are derived from `authority` rather than mints or markets, so:

- One authority can run multiple vaults (different authorities → different vault_config PDAs).
- Admin controls treasury, pause, flash mint settings, and token registration.
- Clear separation between protocol logic and admin policy.

### 4. **Security Through Constraints**

- **Transaction introspection** — Flash mint verifies that `flash_mint_end` exists in the same transaction before minting.
- **PDA uniqueness** — Flash loan state is a one-time PDA per (borrower, vault); prevents double-mint and reentrancy.
- **Slippage protection** — Wrap and unwrap accept `min_out_amount` to guard against unfavorable swaps.
- **Fee caps** — Flash mint fee is capped (e.g., 10000 bps max).
- **Pause** — Emergency stop for wrap/unwrap without affecting admin operations.

### 5. **Yield to Treasury, Not to Wrapped Supply**

Accrued yield from KLend is harvested by the authority into a **treasury** account. The wrapped token remains 1:1 with deposited principal; yield is not automatically compounded into wStable. This keeps the accounting simple and lets the protocol/DAO decide how to use yield (buybacks, grants, etc.).

---

## General Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WRAP FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Base token (USDC):                                                          │
│    User USDC ──► token_vault ──► KLend deposit ──► collateral_vault          │
│                                         │                                    │
│                                         └──► mint wStable to user            │
│                                                                             │
│  Non-base token (USDT, etc.):                                                 │
│    User USDT ──► token_vault ──► Jupiter swap ──► base_token_vault            │
│                                         │                                    │
│                                         └──► KLend deposit ──► mint wStable   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             UNWRAP FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  burn wStable ──► KLend redeem (collateral → base_token_vault)              │
│                         │                                                    │
│                         └──► (optional) Jupiter swap for multi-token        │
│                         │                                                    │
│                         └──► transfer base token to user                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLASH MINT FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Transaction: [flash_mint_start] ... [user ops] ... [flash_mint_end]         │
│                                                                             │
│  Start: mint wStable to borrower, create FlashLoanState PDA                 │
│  Use:  borrower executes arbitrage (DEX swaps, etc.)                         │
│  End:  burn principal, transfer fee to treasury, close PDA                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Account Hierarchy

```
VaultConfig (per authority)
├── usdc_mint          — Base stablecoin (USDC)
├── wrapped_mint       — wStable mint
├── lending_market     — KLend market
├── treasury           — Yield recipient
└── TokenConfig[]      — Per-token registry

TokenConfig (per supported token)
├── token_mint         — Input token (USDC, USDT, …)
├── reserve            — KLend reserve for this token
├── collateral_vault   — Holds KLend kTokens
├── token_vault        — Intermediate storage before KLend/swap
└── is_base_token      — True for USDC (no swap)
```

### PDA Structure

| PDA                      | Seeds                                        | Role                         |
| ------------------------ | -------------------------------------------- | ---------------------------- |
| `vault_config`           | `["vault_config", authority]`                | Vault state, admin settings  |
| `vault_authority`        | `["vault_authority", vault_config]`          | Signs token CPIs             |
| `wrapped_mint`           | `["wrapped_mint", vault_config]`             | wStable mint                 |
| `token_config`           | `["token_config", vault_config, token_mint]` | Per-token config             |
| `token_collateral_vault` | `["token_collateral_vault", token_config]`   | KLend kToken vault           |
| `token_vault`            | `["token_vault", token_config]`              | Pre-deposit/swap vault       |
| `flash_loan`             | `["flash_loan", borrower, vault_config]`     | Flash loan state (ephemeral) |

---

## Key Components

### 1. **Vault & Token Registry**

- **initialize** — Creates vault_config, wrapped_mint, vault_authority. No tokens registered yet.
- **add_token** — Registers a stablecoin with its KLend reserve, collateral vault, and token vault. One token must be marked `is_base_token` (typically USDC).
- **remove_token** — Closes collateral and token vaults, decrements registry. Admin only.

### 2. **Wrap**

- Accepts any registered token.
- Base token: direct deposit to KLend.
- Non-base: swap to base via Jupiter, then deposit.
- Mints wStable 1:1 with base amount deposited.
- Enforces `min_out_amount` for swap slippage.

### 3. **Unwrap**

- Burns wStable.
- Redeems collateral from KLend into base_token_vault.
- Optional Jupiter swap for multi-token unwrap.
- Transfers base token to user.
- Enforces `min_out_amount` for slippage.

### 4. **Harvest Yield**

- Authority redeems excess collateral from KLend for a given token.
- Proceeds go to treasury.
- Used to capture yield beyond what backs wStable supply.

### 5. **Flash Mint**

- **Start** — Mints wStable to borrower, creates FlashLoanState PDA. Requires `flash_mint_end` in same transaction (introspection).
- **End** — Burns principal, transfers fee to treasury, closes PDA.
- **Access** — When disabled, only authority can flash mint; when enabled, anyone can.
- **Fee** — Configurable in basis points, capped.

---

## External Dependencies

| Dependency               | Role                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| **KLend**                | Lending market; `deposit_reserve_liquidity`, `redeem_reserve_collateral` |
| **Jupiter**              | Swap aggregator for non-base tokens                                      |
| **SPL Token**            | Mint, transfer, burn                                                     |
| **Sysvar: Instructions** | Transaction introspection for flash mint                                 |

---

## Security Model

| Threat                             | Mitigation                                            |
| ---------------------------------- | ----------------------------------------------------- |
| Missing `flash_mint_end`           | Transaction introspection before mint                 |
| Wrong borrower/vault in flash mint | Introspection validates accounts                      |
| Double flash mint                  | PDA `init` — one FlashLoanState per (borrower, vault) |
| Swap slippage                      | `min_out_amount` on wrap/unwrap                       |
| Unauthorized admin actions         | `has_one = authority` on admin instructions           |
| Oracle/manipulation                | Delegated to KLend and Jupiter                        |

---

## Summary

Olympus Complex is a **wrapped stablecoin vault** that:

1. **Unifies** multiple stablecoins into one yield-bearing wStable token.
2. **Composes** with KLend for yield and Jupiter for swaps.
3. **Separates** admin policy (authority) from core logic.
4. **Protects** users with slippage limits and flash mint safeguards.
5. **Routes** yield to a configurable treasury instead of auto-compounding into wStable.

The design prioritizes composability, clarity of roles, and reuse of existing Solana DeFi infrastructure over custom, monolithic implementations.
