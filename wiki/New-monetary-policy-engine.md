# New monetary policy engine

When mint authority is extracted from the legacy `wrap-stablecoin` program, a **successor engine** becomes the sole minter for the existing wrapped stablecoin mint (Florin / FLRN). The legacy program retains collateral and serves redemption until legacy liability is exhausted.

This document specifies the interface and responsibilities for that successor. It is a **design contract**, not an in-repo program implementation.

## Responsibilities

The new engine must provide:

| Capability | Description |
|------------|-------------|
| Collateral custody | Own vault PDAs per accepted collateral asset |
| Liability accounting | Per-asset `total_wrapped_minted` / `total_redemptions` (or equivalent) |
| `wrap` | Accept collateral → mint FLRN using extracted SPL mint authority |
| `unwrap` | Burn FLRN → release collateral from **new** vaults |
| Policy | Haircuts, caps, asset status, pause — independent of legacy `AssetConfig` |

The legacy program continues:

| Capability | Description |
|------------|-------------|
| `unwrap` only | Burn FLRN → release from **legacy** `token_vault` |
| KLend ops | Recall liquidity, harvest yield, sweep surplus |
| Liability cap | Per-pool `net_liability` gates legacy redemptions |

Both programs share the **same** `wrapped_mint` address. They do **not** share collateral vault PDAs.

## Mint authority

After legacy `accept_mint_authority`, the successor holds SPL mint authority (wallet, multisig, or program PDA). The successor signs `mint_to` for all new supply.

The legacy `vault_authority` PDA retains token **account** ownership of legacy vaults but cannot mint.

## Collateral model

```text
Legacy wrap-stablecoin                New monetary policy engine
+---------------------------+         +---------------------------+
| token_vault (USDC, …)     |         | new_token_vault (USDC, …) |
| liability_i (legacy)      |         | liability_i (new)         |
| unwrap → legacy collateral|         | wrap / unwrap → new vaults|
+---------------------------+         +---------------------------+
              \                               /
               \   same wrapped_mint (FLRN)  /
                v                             v
                    Fungible FLRN holders
```

Users holding FLRN choose (or routing chooses) which program's `unwrap` to call based on which pools have liability and liquidity. During overlap, legacy redemption consumes legacy liability regardless of which engine originally minted a given unit — see [Mint-authority-migration.md](Mint-authority-migration.md).

## Minimum integration checklist

1. Accept mint authority via legacy `propose_mint_authority` / `accept_mint_authority`.
2. Verify on-chain `mintAuthority` on wrapped mint matches successor signer.
3. Implement collateral-backed mint (never unbacked `mint_to`).
4. Implement unwrap against new vaults for post-migration liability.
5. Monitor legacy `net_liability` per pool until zero before decommissioning legacy vaults.

## Program boundary options

| Destination type | Notes |
|------------------|-------|
| Program PDA (recommended) | Policy enforced on-chain; mint authority held by successor program |
| Multisig / wallet | Possible; requires off-chain or manual policy discipline |

No on-chain destination allowlist is required on the legacy program. Governance chooses the destination at `propose_mint_authority` time.

## Out of scope for legacy program

The legacy `wrap-stablecoin` program does **not**:

- Track mints performed by the successor engine
- Route unwrap automatically between legacy and new vaults
- Migrate collateral PDAs to another program

Those concerns belong to the successor engine and operator runbooks.

## Related

- [Mint-authority-migration.md](Mint-authority-migration.md) — handoff procedure and invariants
- [Accounting.md](Accounting.md) — liability and surplus model
