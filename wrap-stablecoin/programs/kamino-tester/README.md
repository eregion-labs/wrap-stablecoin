# Multi-Stablecoin wStable with Kamino KLend Yield

A Solana program that creates a unified wrapped stablecoin (wStable) backed by multiple stablecoins (USDC, USDT, etc.). Deposited tokens are automatically deposited into Kamino KLend to generate yield. Non-base tokens are swapped to USDC via Jupiter aggregator.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         WRAP FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USDC ──────> token_vault ──────────────> KLend ──> mint wStable │
│                                                                  │
│  USDT ──> token_vault ──> Jupiter ──> base_token_vault ──>       │
│                              swap         (USDC)         KLend   │
│                                              │                   │
│                                              └──> mint wStable   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        UNWRAP FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  burn wStable ──> KLend redeem ──> base_token_vault ──> User     │
│                        │                 (USDC)                  │
│                        │                                         │
│  (if multi-token)      └──> Jupiter swap ──> base_token_vault    │
│                              (USDT→USDC)           │             │
│                                                    └──> User     │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Single wStable Token**: One wrapped token backed by multiple stablecoins
- **Multi-Token Support**: Registry pattern allows adding USDC, USDT, and future stablecoins
- **Jupiter Integration**: Automatic swaps for non-base tokens via Jupiter aggregator
- **KLend Yield**: All deposits earn yield through Kamino KLend
- **Slippage Protection**: Configurable minimum output amounts
- **Flash Mint**: Uncollateralized borrowing within single transaction

## Program ID

```
5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT
```

## Architecture

### Account Structure

```
VaultConfig (one per authority)
├── usdc_mint (USDC)
├── wrapped_mint (wStable)
├── lending_market (KLend)
└── registered_tokens: u8

TokenConfig (one per supported token)
├── token_mint (USDC/USDT/etc)
├── reserve (KLend reserve)
├── collateral_vault (holds kTokens)
├── token_vault (intermediate storage)
├── total_deposited: u64
└── is_base_token: bool
```

### PDAs

| Account | Seeds | Description |
|---------|-------|-------------|
| `vault_config` | `["vault_config", authority]` | Main vault state |
| `vault_authority` | `["vault_authority", vault_config]` | Signs token operations |
| `wrapped_mint` | `["wrapped_mint", vault_config]` | wStable token mint |
| `token_config` | `["token_config", vault_config, token_mint]` | Per-token configuration |
| `token_collateral_vault` | `["token_collateral_vault", token_config]` | Holds KLend kTokens |
| `token_vault` | `["token_vault", token_config]` | Intermediate token storage |
| `flash_loan` | `["flash_loan", borrower, vault_config]` | Flash loan state |

## Data Structures

### VaultConfig

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump seed |
| `authority` | `Pubkey` | Admin authority |
| `treasury` | `Pubkey` | Yield recipient |
| `wrapped_mint` | `Pubkey` | wStable mint address |
| `wrapped_mint_bump` | `u8` | Wrapped mint PDA bump |
| `vault_authority_bump` | `u8` | Vault authority PDA bump |
| `lending_market` | `Pubkey` | KLend lending market |
| `usdc_mint` | `Pubkey` | Base token (USDC) mint |
| `total_stable_deposited` | `u64` | Total deposits across all tokens |
| `registered_tokens` | `u8` | Count of registered tokens |
| `paused` | `bool` | Emergency pause flag |
| `flash_mint_enabled` | `bool` | Flash mint toggle |
| `flash_mint_fee_bps` | `u16` | Flash mint fee (basis points) |

### TokenConfig

| Field | Type | Description |
|-------|------|-------------|
| `bump` | `u8` | PDA bump seed |
| `vault_config` | `Pubkey` | Parent vault config |
| `token_mint` | `Pubkey` | Token mint (USDC/USDT) |
| `token_decimals` | `u8` | Token decimals |
| `reserve` | `Pubkey` | KLend reserve |
| `collateral_mint` | `Pubkey` | KLend kToken mint |
| `collateral_vault` | `Pubkey` | Vault's kToken account |
| `collateral_vault_bump` | `u8` | Collateral vault bump |
| `token_vault` | `Pubkey` | Intermediate token storage |
| `token_vault_bump` | `u8` | Token vault bump |
| `total_deposited` | `u64` | Deposits via this token |
| `is_base_token` | `bool` | True for USDC |
| `enabled` | `bool` | Token acceptance toggle |

## Instructions

### initialize

Create the vault with base configuration. Does not register any tokens.

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Payer and admin |
| `usdc_mint` | No | No | Base token mint (USDC) |
| `vault_config` | No | Yes | Vault config PDA (created) |
| `wrapped_mint` | No | Yes | wStable mint PDA (created) |
| `vault_authority` | No | No | Vault authority PDA |
| `lending_market` | No | No | KLend lending market |
| `treasury` | No | No | Treasury address |
| `token_program` | No | No | SPL Token program |
| `system_program` | No | No | System program |

---

### add_token

Register a new stablecoin. Admin only.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `is_base_token` | `bool` | True if this is the base token (USDC) |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Vault admin |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | No | Vault authority PDA |
| `token_mint` | No | No | Token to register |
| `token_config` | No | Yes | Token config PDA (created) |
| `reserve` | No | No | KLend reserve for token |
| `collateral_mint` | No | No | KLend kToken mint |
| `collateral_vault` | No | Yes | Collateral vault PDA (created) |
| `token_vault` | No | Yes | Token vault PDA (created) |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | kToken program |
| `system_program` | No | No | System program |

---

### remove_token

Remove a registered token. Admin only. Token must have zero deposits.

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Vault admin |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | No | Vault authority PDA |
| `token_config` | No | Yes | Token config (closed) |
| `collateral_vault` | No | Yes | Collateral vault (closed) |
| `token_vault` | No | Yes | Token vault (closed) |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | kToken program |

**Errors:**
- `TokenHasDeposits` - Token still has deposits
- `CannotRemoveBaseToken` - Cannot remove base token

---

### wrap

Deposit any supported stablecoin and receive wStable. Non-base tokens are swapped to USDC via Jupiter.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `amount` | `u64` | Token amount to wrap |
| `min_out_amount` | `u64` | Minimum USDC after swap (slippage) |
| `swap_data` | `Option<Vec<u8>>` | Jupiter swap instruction data (if not base token) |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `user` | Yes | Yes | User depositing |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | Yes | Vault authority PDA |
| `token_config` | No | Yes | Input token config |
| `token_mint` | No | No | Input token mint |
| `user_token` | No | Yes | User's input token account |
| `user_wrapped` | No | Yes | User's wStable account |
| `wrapped_mint` | No | Yes | wStable mint |
| `token_vault` | No | Yes | Input token vault |
| `base_token_config` | No | No | Base token config (if swapping) |
| `usdc_mint` | No | No | Base token mint (USDC) |
| `base_token_vault` | No | Yes | Base token vault (if swapping) |
| `klend_program` | No | No | KLend program |
| `lending_market` | No | No | KLend market |
| `lending_market_authority` | No | No | KLend market authority |
| `base_reserve` | No | Yes | KLend base token reserve |
| `reserve_liquidity_supply` | No | Yes | KLend liquidity supply |
| `reserve_collateral_mint` | No | Yes | KLend kToken mint |
| `base_collateral_vault` | No | Yes | Base collateral vault |
| `jupiter_program` | No | No | Jupiter program (if swapping) |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | kToken program |
| `instruction_sysvar` | No | No | Instructions sysvar |
| `remaining_accounts` | - | - | Jupiter swap accounts |

**Errors:**
- `InvalidAmount` - Amount is zero
- `VaultPaused` - Vault is paused
- `TokenDisabled` - Token not enabled
- `SlippageExceeded` - Swap output below minimum
- `InvalidJupiterRoute` - Missing Jupiter accounts

---

### unwrap

Burn wStable and receive USDC. Redeems from KLend and optionally swaps other tokens to USDC.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `amount` | `u64` | wStable amount to burn |
| `min_out_amount` | `u64` | Minimum USDC to receive |
| `collateral_amount` | `u64` | kTokens to redeem |
| `swap_data` | `Option<Vec<u8>>` | Jupiter swap data (if multi-token) |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `user` | Yes | Yes | User unwrapping |
| `vault_config` | No | Yes | Vault config |
| `vault_authority` | No | Yes | Vault authority PDA |
| `user_wrapped` | No | Yes | User's wStable account |
| `user_base_token` | No | Yes | User's USDC account |
| `wrapped_mint` | No | Yes | wStable mint |
| `usdc_mint` | No | No | Base token mint |
| `base_token_config` | No | Yes | Base token config |
| `base_token_vault` | No | Yes | Base token vault |
| `base_collateral_vault` | No | Yes | Base collateral vault |
| `klend_program` | No | No | KLend program |
| `lending_market` | No | No | KLend market |
| `lending_market_authority` | No | No | KLend market authority |
| `base_reserve` | No | Yes | KLend base token reserve |
| `reserve_liquidity_supply` | No | Yes | KLend liquidity supply |
| `reserve_collateral_mint` | No | Yes | KLend kToken mint |
| `jupiter_program` | No | No | Jupiter program (optional) |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | kToken program |
| `instruction_sysvar` | No | No | Instructions sysvar |
| `remaining_accounts` | - | - | Jupiter swap accounts |

**Errors:**
- `InvalidAmount` - Amount is zero
- `InsufficientBalance` - Not enough deposited
- `VaultPaused` - Vault is paused
- `SlippageExceeded` - Output below minimum

---

### harvest_yield

Redeem accumulated yield from a specific token to treasury. Admin only.

**Arguments:**
| Name | Type | Description |
|------|------|-------------|
| `collateral_amount` | `u64` | kTokens representing yield to redeem |

**Accounts:**
| Account | Signer | Mutable | Description |
|---------|--------|---------|-------------|
| `authority` | Yes | Yes | Vault admin |
| `vault_config` | No | No | Vault config |
| `vault_authority` | No | Yes | Vault authority PDA |
| `token_config` | No | Yes | Token config to harvest from |
| `token_mint` | No | No | Token mint |
| `treasury` | No | Yes | Treasury token account |
| `collateral_vault` | No | Yes | Token's collateral vault |
| `klend_program` | No | No | KLend program |
| `lending_market` | No | No | KLend market |
| `lending_market_authority` | No | No | KLend market authority |
| `reserve` | No | Yes | KLend reserve |
| `reserve_liquidity_supply` | No | Yes | KLend liquidity supply |
| `reserve_collateral_mint` | No | Yes | KLend kToken mint |
| `token_program` | No | No | SPL Token program |
| `collateral_token_program` | No | No | kToken program |
| `instruction_sysvar` | No | No | Instructions sysvar |

---

### Admin Instructions

#### set_paused
Pause/unpause the vault.

#### update_treasury
Update treasury address.

#### transfer_authority
Transfer admin authority.

#### set_flash_mint_fee
Set flash mint fee (0-10000 bps).

#### set_flash_mint_enabled
Enable/disable public flash minting.

---

### Flash Mint Instructions

#### flash_mint_start
Borrow wStable tokens (must be repaid in same transaction).

#### flash_mint_end
Repay borrowed tokens plus fee.

## Error Codes

| Code | Name | Message |
|------|------|---------|
| 6000 | `VaultPaused` | Vault is currently paused |
| 6001 | `InsufficientBalance` | Insufficient balance for operation |
| 6002 | `NoYieldAvailable` | No yield available to harvest |
| 6003 | `Unauthorized` | Unauthorized access |
| 6004 | `MathOverflow` | Math overflow |
| 6005 | `InvalidAmount` | Invalid amount |
| 6006 | `FlashMintDisabled` | Flash mint feature is disabled |
| 6007 | `MissingFlashMintEnd` | Missing flash_mint_end in transaction |
| 6008 | `InvalidFlashLoan` | Invalid flash loan state |
| 6009 | `InsufficientRepayment` | Cannot repay flash loan |
| 6010 | `InvalidFlashMintFee` | Fee exceeds maximum |
| 6011 | `TokenDisabled` | Token is disabled |
| 6012 | `TokenHasDeposits` | Token has deposits, cannot remove |
| 6013 | `CannotRemoveBaseToken` | Cannot remove base token |
| 6014 | `TokenAlreadyRegistered` | Token already registered |
| 6015 | `MaxTokensReached` | Maximum tokens registered |
| 6016 | `SlippageExceeded` | Slippage tolerance exceeded |
| 6017 | `InvalidJupiterRoute` | Invalid Jupiter route |
| 6018 | `SwapFailed` | Swap failed |
| 6019 | `TokenNotFound` | Token not found |

## External Integrations

### KLend
- **Program ID**: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- Functions: `deposit_reserve_liquidity`, `redeem_reserve_collateral`

### Jupiter
- **Program ID**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- Client fetches swap route from Jupiter API
- Raw instruction data passed to program

## Usage Examples

### Initialize Vault

```typescript
await program.methods
  .initialize()
  .accounts({
    authority: wallet.publicKey,
    baseMint: USDC_MINT,
    lendingMarket: KLEND_MARKET,
    treasury: treasuryAccount,
  })
  .rpc();
```

### Add Token (USDC as base)

```typescript
await program.methods
  .addToken(true) // is_base_token = true
  .accounts({
    authority: wallet.publicKey,
    tokenMint: USDC_MINT,
    reserve: USDC_RESERVE,
    collateralMint: USDC_KTOKEN_MINT,
  })
  .rpc();
```

### Add Token (USDT)

```typescript
await program.methods
  .addToken(false) // is_base_token = false
  .accounts({
    authority: wallet.publicKey,
    tokenMint: USDT_MINT,
    reserve: USDT_RESERVE,
    collateralMint: USDT_KTOKEN_MINT,
  })
  .rpc();
```

### Wrap USDC (Base Token)

```typescript
await program.methods
  .wrap({
    amount: new BN(1_000_000), // 1 USDC
    minOutAmount: new BN(0),   // No swap needed
    swapData: null,
  })
  .accounts({
    user: wallet.publicKey,
    tokenConfig: usdcTokenConfig,
    userToken: userUsdcAta,
    userWrapped: userWstableAta,
    // ... other accounts
  })
  .rpc();
```

### Wrap USDT (Non-Base Token with Jupiter Swap)

```typescript
// 1. Fetch Jupiter quote
const quote = await fetch(
  `https://quote-api.jup.ag/v6/quote?inputMint=${USDT}&outputMint=${USDC}&amount=1000000`
);

// 2. Get swap instruction
const swapIx = await fetch('https://quote-api.jup.ag/v6/swap-instructions', {
  method: 'POST',
  body: JSON.stringify({ quoteResponse: quote, userPublicKey: vaultAuthority }),
});

// 3. Execute wrap with swap
await program.methods
  .wrap({
    amount: new BN(1_000_000),      // 1 USDT
    minOutAmount: new BN(990_000),  // Min 0.99 USDC (1% slippage)
    swapData: Buffer.from(swapIx.swapInstruction.data),
  })
  .accounts({
    user: wallet.publicKey,
    tokenConfig: usdtTokenConfig,
    baseTokenConfig: usdcTokenConfig,
    baseTokenVault: usdcTokenVault,
    jupiterProgram: JUPITER_PROGRAM_ID,
    // ... other accounts
  })
  .remainingAccounts(swapIx.addressLookupTableAccounts)
  .rpc();
```

### Unwrap to USDC

```typescript
await program.methods
  .unwrap({
    amount: new BN(1_000_000),          // 1 wStable
    minOutAmount: new BN(990_000),      // Min USDC (slippage)
    collateralAmount: new BN(1_000_000), // kTokens to redeem
    swapData: null,                      // No swap if only base token
  })
  .accounts({
    user: wallet.publicKey,
    userWrapped: userWstableAta,
    userBaseToken: userUsdcAta,
    baseTokenConfig: usdcTokenConfig,
    // ... other accounts
  })
  .rpc();
```

## Building & Testing

```bash
# Build
anchor build

# Test
anchor test

# Deploy (devnet)
anchor deploy --provider.cluster devnet

# Deploy (mainnet)
anchor deploy --provider.cluster mainnet
```

## Security Considerations

1. **PDA Authority**: All token operations require PDA signatures
2. **Slippage Protection**: Configurable minimum output for swaps
3. **Admin Controls**: Pause, token enable/disable
4. **Jupiter Trust**: Swap data from trusted Jupiter API
5. **Collateral Calculation**: Off-chain calculation for kToken amounts
