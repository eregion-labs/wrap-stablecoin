# Kamino Tester

A Solana program that wraps stablecoins (USDC) into yield-bearing wrapped tokens (wStable) using Kamino Lending (KLend) as the underlying yield source.

## Overview

This program provides:
- **Wrap**: Deposit USDC, receive wStable tokens (1:1), USDC is deposited into KLend to earn yield
- **Unwrap**: Burn wStable tokens, receive USDC back from KLend
- **Harvest Yield**: Authority can harvest accrued yield (excess collateral) to treasury
- **Flash Mint**: Borrow wStable tokens without collateral, repay within the same transaction (for arbitrage)

## Architecture

```
User USDC ──► Wrap ──► KLend Deposit ──► Collateral Vault
                              │
                              ▼
                         wStable Mint ──► User wStable

User wStable ──► Unwrap ──► Burn wStable
                              │
                              ▼
                         KLend Redeem ──► User USDC

Flash Mint Flow:
┌─────────────────────────────────────────────────────────────┐
│ Transaction                                                  │
│  [1] flash_mint_start ──► Mint wStable to borrower          │
│  [2] ... user operations (DEX swaps, arbitrage) ...         │
│  [3] flash_mint_end ──► Burn principal + transfer fee       │
└─────────────────────────────────────────────────────────────┘
```

## Program Instructions

| Instruction | Description |
|------------|-------------|
| `initialize` | Initialize vault config, wrapped mint, and collateral vault |
| `wrap` | Deposit USDC, mint wStable, deposit to KLend |
| `unwrap` | Burn wStable, redeem from KLend, return USDC |
| `harvest_yield` | Redeem excess collateral to treasury (authority only) |
| `set_paused` | Pause/unpause the vault (authority only) |
| `update_treasury` | Update treasury address (authority only) |
| `transfer_authority` | Transfer vault authority (authority only) |
| `flash_mint_start` | Start flash mint - mint tokens to borrower |
| `flash_mint_end` | End flash mint - burn principal, transfer fee |
| `set_flash_mint_fee` | Set flash mint fee in basis points (authority only) |
| `set_flash_mint_enabled` | Enable/disable flash mint for public (authority only) |

## Flash Mint

Flash mint allows users to borrow wStable tokens without collateral, use them within the same transaction, and repay with a fee. This is useful for arbitrage opportunities.

### How It Works

1. **Start**: `flash_mint_start` mints tokens to borrower and creates a temporary `FlashLoanState` PDA
2. **Use**: Borrower executes operations (DEX swaps, arbitrage, etc.)
3. **End**: `flash_mint_end` burns the principal, transfers fee to treasury, and closes the loan state

### Configuration

- **Fee**: Configurable in basis points (e.g., 50 bps = 0.5%)
- **Access Control**:
  - When disabled: Only admin (authority) can use flash mint
  - When enabled: Anyone can use flash mint
- **Default**: Disabled with 0 fee

### Security

| Protection | Mechanism |
|------------|-----------|
| Missing `flash_mint_end` | Transaction introspection verifies end instruction exists before minting |
| Mismatched accounts | Introspection verifies borrower, vault_config, and flash_loan_state match |
| Double mint attack | PDA `init` constraint prevents creating same flash_loan_state twice |
| Reentrancy | One flash loan per user per vault at a time (PDA uniqueness) |

### Usage Example

```typescript
// Arbitrage transaction
const tx = new Transaction();
tx.add(flashMintStartIx(amount));      // Borrow 1000 wStable
tx.add(swapOnDexA(wStable, tokenX));   // Swap wStable -> Token X
tx.add(swapOnDexB(tokenX, wStable));   // Swap Token X -> wStable (profit)
tx.add(flashMintEndIx());              // Repay 1000 + fee
await sendTransaction(tx);
```

## Building

```bash
anchor build
```

## Testing

```bash
anchor test
```

### Integration Test Coverage

The integration test (`programs/kamino-tester/tests/integration_test.rs`) verifies:

| Component | Status | Description |
|-----------|--------|-------------|
| KLend Lending Market | ✓ | Creates and initializes a new lending market |
| KLend Reserve | ✓ | Creates USDC reserve with collateral mint |
| KLend Global Config | ✓ | Initializes global config for reserve updates |
| Reserve Config Update | ✓ | Verifies `update_reserve_config` instruction serialization |
| Vault Initialization | ✓ | Creates vault_config, wrapped_mint, collateral_vault PDAs |
| Wrap CPI | ✓ | Verifies CPI to KLend's `deposit_reserve_liquidity` |
| Unwrap CPI | ✓ | Verifies CPI to KLend's `redeem_reserve_collateral` |
| Harvest Yield CPI | ✓ | Verifies CPI to KLend's `redeem_reserve_collateral` for treasury |

### Flash Mint Test Coverage

The flash mint tests (`test_flash_mint`) verify:

| Test | Description |
|------|-------------|
| Set flash mint fee | Admin can configure fee in basis points |
| Non-admin blocked when disabled | Regular users cannot flash mint when feature is disabled |
| Admin bypass when disabled | Authority can use flash mint even when disabled |
| Enable flash mint | Admin can enable flash mint for all users |
| Missing flash_mint_end rejected | Transaction fails if flash_mint_end is not in same transaction |
| Complete flash mint flow | Full start → end flow with fee payment |
| Double mint attack rejected | Cannot call flash_mint_start twice with one end |
| Disable flash mint | Admin can disable flash mint |

### Test Limitations

The local test environment has limitations due to KLend's validation requirements:

1. **Deposit Limit**: KLend's `init_reserve` initializes `deposit_limit = 0`. Updating it requires:
   - `update_reserve_config` with `skip_validation = true`
   - Specific reserve state validation that requires oracle setup

2. **Oracle Configuration**: KLend validates oracle configuration for deposits, which requires:
   - Pyth/Switchboard price feeds
   - Scope oracle configuration

**For full end-to-end testing**, use one of these approaches:
- Fork devnet/mainnet to use existing reserves with configured oracles
- Set up mock oracle accounts locally

### KLend CPI Serialization Notes

When building CPI instructions to KLend:

```rust
// UpdateConfigMode enum is #[repr(u64)] but Anchor serializes as u8 variant index
struct UpdateReserveConfigArgs {
    mode: u8,  // NOT u64
    value: Vec<u8>,
    skip_validation: bool,
}

// Mode values (may vary between KLend versions):
const UPDATE_CONFIG_MODE_DEPOSIT_LIMIT: u8 = 8;
const UPDATE_CONFIG_MODE_BORROW_LIMIT: u8 = 9;
```

## Project Structure

```
kamino-tester/
├── programs/kamino-tester/
│   ├── src/
│   │   ├── lib.rs              # Program entrypoint and instruction handlers
│   │   ├── instructions/       # Instruction account contexts
│   │   │   ├── initialize.rs
│   │   │   ├── wrap.rs
│   │   │   ├── unwrap.rs
│   │   │   ├── harvest_yield.rs
│   │   │   ├── admin.rs
│   │   │   └── flash_mint.rs   # Flash mint instructions and introspection
│   │   ├── state/              # Account structures
│   │   │   ├── vault_config.rs # VaultConfig with flash mint settings
│   │   │   └── flash_loan_state.rs # Temporary flash loan tracking
│   │   ├── errors.rs           # Custom error codes
│   │   └── klend/              # KLend CPI helpers
│   │       └── cpi.rs
│   └── tests/
│       ├── integration_test.rs # Full integration test + flash mint tests
│       ├── klend_init.rs       # KLend initialization tests
│       └── wrapped_token_test.rs
├── so/
│   └── klend.so                # KLend program binary for local testing
└── Anchor.toml
```

## Dependencies

- Anchor Framework
- SPL Token / Token-2022
- Kamino Lending (KLend) Program

## License

[Add license information]
