# Kamino Tester

A Solana program that wraps stablecoins (USDC) into yield-bearing wrapped tokens (wStable) using Kamino Lending (KLend) as the underlying yield source.

## Overview

This program provides:
- **Wrap**: Deposit USDC, receive wStable tokens (1:1), USDC is deposited into KLend to earn yield
- **Unwrap**: Burn wStable tokens, receive USDC back from KLend
- **Harvest Yield**: Authority can harvest accrued yield (excess collateral) to treasury

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
│   │   │   └── admin.rs
│   │   ├── state.rs            # VaultConfig account structure
│   │   ├── errors.rs           # Custom error codes
│   │   └── klend/              # KLend CPI helpers
│   │       └── cpi.rs
│   └── tests/
│       ├── integration_test.rs # Full integration test
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
