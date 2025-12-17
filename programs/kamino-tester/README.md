# Wrapped USDC with Kamino KLend Yield

A Solana program that creates a wrapped USDC token (wStable) where deposited USDC is automatically deposited into Kamino KLend to generate yield. Yield accrues to a protocol treasury.

## Overview

```
User USDC ──> [wrap] ──> KLend Reserve ──> kTokens held by vault
                │
                └──> Mint wStable to User (1:1)

User wStable ──> [unwrap] ──> Burn wStable ──> Redeem kTokens ──> Return USDC

[harvest_yield] ──> Redeem excess kTokens ──> USDC to Treasury
```

## Program ID

```
5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT
```

## Accounts

### VaultConfig

Main state account storing vault configuration. PDA seeds: `["vault_config", usdc_mint]`

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump seed |
| `authority` | `Pubkey` | Admin authority for privileged operations |
| `treasury` | `Pubkey` | Account receiving harvested yield |
| `wrapped_mint` | `Pubkey` | wStable mint address |
| `wrapped_mint_bump` | `u8` | Wrapped mint PDA bump |
| `usdc_mint` | `Pubkey` | USDC mint address |
| `lending_market` | `Pubkey` | KLend lending market |
| `reserve` | `Pubkey` | KLend USDC reserve |
| `collateral_mint` | `Pubkey` | KLend collateral token (kToken) mint |
| `collateral_vault` | `Pubkey` | Vault's kToken account |
| `collateral_vault_bump` | `u8` | Collateral vault PDA bump |
| `vault_authority_bump` | `u8` | Vault authority PDA bump |
| `total_usdc_deposited` | `u64` | Total USDC deposited by users |
| `paused` | `bool` | Emergency pause flag |

### PDAs

| Account | Seeds | Description |
|---------|-------|-------------|
| `vault_config` | `["vault_config", usdc_mint]` | Main program state |
| `wrapped_mint` | `["wrapped_mint", vault_config]` | wStable token mint |
| `collateral_vault` | `["collateral_vault", vault_config]` | Holds KLend kTokens |
| `vault_authority` | `["vault_authority", vault_config]` | Signs token operations |

## Instructions

### initialize

Create and initialize the vault with all necessary accounts.

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Payer and initial admin |
| `usdc_mint` | No | No | USDC mint to wrap |
| `vault_config` | No | Yes | Vault config PDA (created) |
| `wrapped_mint` | No | Yes | wStable mint PDA (created) |
| `vault_authority` | No | No | Vault authority PDA |
| `lending_market` | No | No | KLend lending market |
| `reserve` | No | No | KLend USDC reserve |
| `collateral_mint` | No | No | KLend kToken mint |
| `collateral_vault` | No | Yes | Collateral vault PDA (created) |
| `treasury` | No | No | Treasury to receive yield |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | Token program for kTokens |
| `system_program` | No | No | System program |

---

### wrap

Deposit USDC and receive wStable at 1:1 ratio. USDC is deposited into KLend.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `amount` | `u64` | USDC amount to wrap |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `user` | Yes | Yes | User depositing USDC |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | No | Vault authority PDA |
| `user_usdc` | No | Yes | User's USDC token account |
| `user_wrapped` | No | Yes | User's wStable token account |
| `wrapped_mint` | No | Yes | wStable mint |
| `klend_program` | No | No | KLend program |
| `lending_market` | No | No | KLend lending market |
| `lending_market_authority` | No | No | KLend market authority PDA |
| `reserve` | No | Yes | KLend USDC reserve |
| `reserve_liquidity_supply` | No | Yes | KLend reserve liquidity vault |
| `reserve_collateral_mint` | No | Yes | KLend kToken mint |
| `collateral_vault` | No | Yes | Vault's kToken account |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | Token program for kTokens |
| `instruction_sysvar` | No | No | Instructions sysvar |

**Errors:**
- `InvalidAmount` - Amount is zero
- `VaultPaused` - Vault is paused

---

### unwrap

Burn wStable and receive USDC back. USDC is redeemed from KLend.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `amount` | `u64` | wStable amount to unwrap |
| `collateral_amount` | `u64` | kTokens to redeem (calculated off-chain based on exchange rate) |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `user` | Yes | Yes | User unwrapping |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | No | Vault authority PDA |
| `user_wrapped` | No | Yes | User's wStable token account |
| `user_usdc` | No | Yes | User's USDC token account |
| `wrapped_mint` | No | Yes | wStable mint |
| `klend_program` | No | No | KLend program |
| `lending_market` | No | No | KLend lending market |
| `lending_market_authority` | No | No | KLend market authority PDA |
| `reserve` | No | Yes | KLend USDC reserve |
| `reserve_liquidity_supply` | No | Yes | KLend reserve liquidity vault |
| `reserve_collateral_mint` | No | Yes | KLend kToken mint |
| `collateral_vault` | No | Yes | Vault's kToken account |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | Token program for kTokens |
| `instruction_sysvar` | No | No | Instructions sysvar |

**Errors:**
- `InvalidAmount` - Amount or collateral_amount is zero
- `InsufficientBalance` - Not enough USDC deposited in vault
- `VaultPaused` - Vault is paused

---

### harvest_yield

Redeem accumulated yield to treasury. Admin only.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `collateral_amount` | `u64` | kTokens representing yield to redeem |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Vault admin |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | No | Vault authority PDA |
| `treasury` | No | Yes | Treasury USDC account |
| `klend_program` | No | No | KLend program |
| `lending_market` | No | No | KLend lending market |
| `lending_market_authority` | No | No | KLend market authority PDA |
| `reserve` | No | Yes | KLend USDC reserve |
| `reserve_liquidity_supply` | No | Yes | KLend reserve liquidity vault |
| `reserve_collateral_mint` | No | Yes | KLend kToken mint |
| `collateral_vault` | No | Yes | Vault's kToken account |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | Token program for kTokens |
| `instruction_sysvar` | No | No | Instructions sysvar |

**Errors:**
- `Unauthorized` - Caller is not authority
- `InvalidAmount` - Collateral amount is zero

---

### set_paused

Pause or unpause the vault. Admin only.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `paused` | `bool` | New paused state |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Vault admin |
| `vault_config` | No | Yes | Vault config |

**Errors:**
- `Unauthorized` - Caller is not authority

---

### update_treasury

Update the treasury address. Admin only.

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Vault admin |
| `vault_config` | No | Yes | Vault config |
| `new_treasury` | No | No | New treasury address |

**Errors:**
- `Unauthorized` - Caller is not authority

---

### transfer_authority

Transfer admin authority to a new address. Admin only.

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Current admin |
| `vault_config` | No | Yes | Vault config |
| `new_authority` | No | No | New admin address |

**Errors:**
- `Unauthorized` - Caller is not authority

## Error Codes

| Code | Name | Message |
|------|------|---------|
| 6000 | `VaultPaused` | Vault is currently paused |
| 6001 | `InsufficientBalance` | Insufficient balance for operation |
| 6002 | `NoYieldAvailable` | No yield available to harvest |
| 6003 | `Unauthorized` | Unauthorized access |
| 6004 | `MathOverflow` | Math overflow |
| 6005 | `InvalidAmount` | Invalid amount |

## KLend Integration

The program integrates with Kamino KLend using manual CPI instruction construction:

- **KLend Program ID**: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- **Lending Market Authority Seed**: `b"lma"`

### CPI Functions

```rust
// Deposit USDC into KLend reserve
deposit_reserve_liquidity_ix(...)

// Redeem kTokens for USDC
redeem_reserve_collateral_ix(...)

// Refresh reserve (for oracle updates)
refresh_reserve_ix(...)
```

## Building

```bash
anchor build
```

## Testing

```bash
anchor test
```

## Deployment

```bash
# Devnet
anchor deploy --provider.cluster devnet

# Mainnet
anchor deploy --provider.cluster mainnet
```

## Usage Example (TypeScript)

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KaminoTester } from "../target/types/kamino_tester";

// Initialize vault
await program.methods
  .initialize()
  .accounts({
    authority: wallet.publicKey,
    usdcMint: USDC_MINT,
    lendingMarket: KLEND_MARKET,
    reserve: USDC_RESERVE,
    collateralMint: KTOKENMINT,
    treasury: treasuryAccount,
  })
  .rpc();

// Wrap USDC
await program.methods
  .wrap({ amount: new anchor.BN(1_000_000) }) // 1 USDC
  .accounts({
    user: wallet.publicKey,
    userUsdc: userUsdcAta,
    userWrapped: userWrappedAta,
    // ... other accounts
  })
  .rpc();

// Unwrap wStable
await program.methods
  .unwrap({
    amount: new anchor.BN(1_000_000),
    collateralAmount: new anchor.BN(calculatedKTokens),
  })
  .accounts({
    user: wallet.publicKey,
    userUsdc: userUsdcAta,
    userWrapped: userWrappedAta,
    // ... other accounts
  })
  .rpc();
```

## Security Considerations

1. **PDA Authority**: All token operations require PDA signatures
2. **Admin Controls**: Pause functionality for emergencies
3. **Yield Calculation**: Off-chain calculation required for `collateral_amount` in unwrap/harvest
4. **Exchange Rate**: KLend exchange rate should be queried before unwrap operations
