# Mint authority migration

Extractable mint authority lets the vault transfer SPL **mint authority** for the wrapped stablecoin (Florin / FLRN) to a new program or wallet while the legacy wrapper continues as a **redemption-only** service.

## Post-transfer invariants

After `accept_mint_authority` completes:

1. **Old wrapper never increases liability** — `wrap` is permanently disabled before any collateral transfer.
2. **Old wrapper never mints** — SPL mint authority no longer resides on `vault_authority`.
3. **Old wrapper only burns and releases collateral** — `unwrap` remains available subject to per-pool liability and liquidity.
4. **New engine exclusively controls future minting** — only the accepted destination can call SPL `MintTo` on the wrapped mint.
5. **Legacy liabilities only decrease** — `total_wrapped_minted`, `total_stable_deposited`, and per-pool `net_liability` decrement via `unwrap` only.

## Two-step handoff

| Instruction | Signer | Effect |
|-------------|--------|--------|
| `propose_mint_authority` | `admin` | Sets `VaultConfig.pending_mint_authority` |
| `cancel_propose_mint_authority` | `admin` | Clears pending proposal |
| `accept_mint_authority` | `pending_mint_authority` | CPI `SetAuthority`; sets `mint_authority_transferred = true`; disables `mint_enabled` on all registered assets |

The destination authority is an **explicit admin choice** at proposal time. No on-chain allowlist or registry is enforced.

### `accept_mint_authority` accounts

Core accounts: `vault_config`, `wrapped_mint`, `vault_authority`, `new_mint_authority` (signer), `token_program`.

**Remaining accounts:** one writable `AssetConfig` PDA per registered asset (same order as `registered_assets`). Each asset has `mint_enabled` set to `false`.

## Recommended operator sequence

```text
1. Admin calls propose_mint_authority(new_authority)
2. Operators verify destination off-chain (program ID, PDA seeds, multisig members)
3. Destination calls accept_mint_authority (with asset config remaining accounts)
4. New monetary policy engine enables wrap against its own collateral vaults
5. Old wrapper serves legacy unwrap until per-pool liability reaches zero
6. Admin sweeps surplus and decommissions legacy vaults when complete
```

Pausing wrap or minimizing overlap before handoff is **optional** — see overlap guidance below.

## Overlap between old and new engines

Overlap is **not a protocol vulnerability**. Florin (FLRN) is intentionally fungible.

If the new engine mints only against collateral deposited into **its own vaults**, then Florin (FLRN) minted by the new engine that redeems through **legacy** pools during overlap simply shifts redemption obligations between balance sheets.

Operational guidance:

- New engine must only mint against real collateral.
- Operators should track that legacy redemption during overlap consumes remaining per-pool liability on the old wrapper.
- Sequencing migration to minimize overlap is a business decision, not a security requirement.

## What stays on the old wrapper

| Right | After transfer |
|-------|----------------|
| SPL mint authority | Moved to new destination |
| `token_vault` / treasury / Kamino vault ownership | Remains on `vault_authority` PDA |
| Admin policy (pause, KLend, surplus sweep) | Unchanged |
| Immutable vault identity (`authority` seed) | Unchanged |

Full collateral custody cannot be moved to another program without unwinding positions and re-depositing under new PDAs.

## Related

- [New monetary policy engine](New-monetary-policy-engine.md) — requirements for the successor minter
- [On-chain program](On-chain-program.md) — instruction reference
- [Accounting](Accounting.md) — per-pool liability model
