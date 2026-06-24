# On-chain program

Program ID: `5JmAnBvF8akh9N36bqoxZdAsyv4SeW6oNedJpj3WUSoT`

## Model

wStable is a **governed multi-reserve stablecoin**: one wrapped mint, many collateral `AssetConfig` accounts (PDA seed `token_config`). Kamino integration is optional per asset via a separate `KLendConfig` account.

```text
Asset
 |
 +-- token_vault        (user backing / redemption liquidity)
 +-- collateral_vault   (Kamino kTokens; admin treasury investment)
 +-- treasury_vault     (protocol yield; not wStable backing)
```

**User path:** `wrap` and `unwrap` only touch `token_vault`. **Admin path:** Kamino CPIs via `deposit_to_klend`, `withdraw_from_klend`, `withdraw_all_from_klend`, and `harvest_yield`.

## Core instructions

| Instruction | Who | Description |
|-------------|-----|-------------|
| `initialize` | authority | Create vault + wStable mint |
| `add_asset` | admin | Register collateral: `AssetConfig`, `token_vault`, `treasury_vault`, policy defaults |
| `enable_klend` | admin | Attach `KLendConfig` + collateral vault for Kamino CPI |
| `update_asset_policy` | admin | Mint/redeem flags, haircuts, caps, status |
| `wrap` | user | Deposit chosen asset → `token_vault` → mint wStable |
| `unwrap` | user | Burn wStable → transfer from `token_vault` only; capped by pool `liability` |
| `deposit_to_klend` | admin | Per-asset KLend CPI; respects `min_liquidity_target` cushion |
| `deposit_all_to_klend` | admin | Deploy `token_vault − cushion` to Kamino |
| `withdraw_from_klend` | admin | Per-asset KLend CPI → free vault |
| `withdraw_all_from_klend` | admin | Recall full Kamino position → free vault |
| `harvest_yield` | admin | Kamino surplus → `treasury_vault` (enforced on-chain) |
| `sweep_home_surplus` | admin | Home vault surplus → `treasury_vault` (post-recall) |
| `withdraw_treasury` | admin | Move yield from `treasury_vault` to a destination ATA |

## AssetConfig (per collateral)

Underlying mint, `token_vault`, `treasury_vault`, accounting, mint/redeem policy, haircuts, caps, `asset_status`. No Kamino accounts.

## KLendConfig (optional per asset)

PDA seeds: `["klend_config", asset_config]`. Lending market, reserve, liquidity supply, collateral mint/vault, `total_liquidity_in_klend`. Used only by admin Kamino instructions.

## Treasury vault

PDA seeds: `["treasury_vault", asset_config]`. Initialized in `add_asset`. Owned by `vault_authority`. Harvested Kamino yield lands here; it does **not** back wStable. Admin realizes revenue via `withdraw_treasury`.

## Example bootstrap

```
initialize()
add_asset(USDC)
enable_klend(USDC)

add_asset(Stable)          # vault-only today
enable_klend(Stable)       # when a market exists
```

## Invariants

- `reject_reflexive_collateral`: underlying mint cannot equal wStable mint
- Per asset: `net_liability = total_wrapped_minted - total_redemptions` (wStable atoms)
- Unwrap sources liquidity **only** from `token_vault`; never from `treasury_vault` or Kamino CPIs
- KLend ops fail with `KlendNotEnabled` when no `KLendConfig` exists

## Redemption

See [Redemption.md](Redemption.md) for vault-only unwrap and operator pre-withdraw workflow.
