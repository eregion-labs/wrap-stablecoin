# Operations

Operator runbook for deposit/redemption decoupling and per-pool surplus management.

## Dashboard fields (`GET /v1/vault/assets`)

| Field | Meaning |
|---|---|
| `freeLiquidity` | `token_vault` balance (home vault) |
| `deployedToKamino` | Principal tracked in Kamino (`total_liquidity_in_klend`) |
| `liability` | Florin (FLRN) redemption obligation for this pool |
| `backing` | `freeLiquidity + deployedToKamino` |
| `homeSurplus` | Sweepable home vault excess above liability + cushion |
| `cushion` | Cushion — pool min liquidity (home-vault reserve; on-chain `min_liquidity_target`) |
| `maxRedeemable` | Max Florin (FLRN) burnable from this pool now |
| `collateralKtokens` | kTokens held in `collateral_vault` |
| `kaminoAvailableLiquidity` | Reserve free liquidity (underlying) available for redeem |
| `maxRecallableKtokens` | Max kTokens for a raw kToken withdraw (holdings ∩ reserve liquidity); admin Yield Max uses underlying `min(deployedToKamino + kaminoSurplus, kaminoAvailableLiquidity)` instead |
| `maxHarvestableKtokens` | Max kTokens for `harvest-yield` (surplus converted at exchange rate) |
| `kaminoSupplyApyBps` | Current Kamino supply APY in bps (`null` if Kamino off) |

See [Accounting.md](Accounting.md) for formulas.

## Normal operations

1. **Issue path:** User `wrap` → collateral lands in `token_vault`; pool `liability` increases.
2. **Deploy yield:** Admin `deposit_to_klend` (respects cushion). Use `deposit_all_to_klend` to deploy `vault − cushion`.
3. **Harvest:** Admin `harvest_yield` up to Kamino surplus (on-chain enforced).
4. **Treasury exit:** Admin `withdraw_treasury` — never redeployable to Kamino.

## Redemption windows

Before heavy redemptions:

1. Check `GET /v1/quote/redeem` for `canRedeem`, `liquidityShortfall`, `liabilityShortfall`.
2. If `freeLiquidity < expected payout`, call `withdraw_from_klend` or `withdraw_all_from_klend`.
3. Users redeem only up to `maxRedeemable` per pool (liability cap + vault liquidity).

User unwrap never recalls Kamino automatically.

## Emergency recall

1. `withdraw_all_from_klend` per asset → all principal + yield in home vault.
2. `sweep_home_surplus` up to `homeSurplus` → `treasury_vault`.
3. Surplus was never user-redeemable (`unwrap` capped by `liability`).

## Policy controls

- **Stop mint:** `update_asset_policy` → `mint_enabled: false` or `asset_status: RedeemOnly`.
- **Stop redeem:** `redeem_enabled: false` or `asset_status: MintOnly`.
- **Global pause:** `set_paused` — blocks wrap, unwrap, Kamino deposit, and harvest. Kamino recall, sweep home surplus, and treasury withdrawal still work.
- **Public wrap/unwrap:** `set_wrap_public` / `set_unwrap_public`; when false, callers must be on the allowlist (or be admin). Init the allowlist PDA and add members **before** flipping a flag private.
- **Cushion:** set the pool’s min liquidity (`min_liquidity_target`) to reserve home vault on Kamino deploy and home-surplus sweep.

## Vault layout revisions

`VaultConfig`'s discriminator is pinned to `b"vaultcf2"` (`VAULT_CONFIG_DISCRIMINATOR` in `state/vault_config.rs`), not derived from the type name. Dropping `asset_count`/`registered_assets` shifted every field from `total_stable_deposited` onward 257 bytes earlier (`admin` and everything before `total_stable_deposited` kept its offset, which is what made the break easy to miss). The pin is what turns a stale vault into a hard `AccountDiscriminatorMismatch` instead of a decode into garbage `total_stable_deposited`, `paused`, `wrap_public` and `mint_authority_transferred` — silent on a vault whose registry was still empty, and a misleading `AccountDidNotDeserialize` once assets were registered.

**A vault initialized before that change cannot be read, repaired, or migrated.** Deploying this program against an existing devnet or mainnet vault will fail every instruction that touches `vault_config`. Because the PDA is seeded `["vault_config", authority]` and `initialize` uses `init`, the old address stays occupied — you cannot re-init over it. To bring up a working vault:

1. Generate a **new authority keypair** — this is what makes the `vault_config` PDA address different.
2. Run `initialize` against it, then `add_asset` and `enable_klend` per collateral.
3. Repoint the backend at the new authority: `VAULT_AUTHORITY_DEVNET` (or `VAULT_AUTHORITY_LOCALNET` / `VAULT_AUTHORITY_MAINNET`, falling back to the unsuffixed `VAULT_AUTHORITY`), then restart it.
4. Rebuild and redistribute the IDL: `anchor idl build -o target/idl/wrap_stablecoin.json -t target/types/wrap_stablecoin.ts`, then the `sync-idl` flow. Both artifacts embed the discriminator and both are read by clients (`target/types` by the TS tests and scripts), so regenerating only one leaves a copy that cannot decode the new vault.

Any future change that moves or removes an existing `VaultConfig` field must bump the trailing digit of the pinned discriminator, or the same silent-decode hazard returns.

## Launch recipe (open wrap, discounted redeem)

Init already defaults both flags to public and haircuts to 0. Launch posture is ops, not code defaults.

1. Keep **wrap public** (`set-wrap-public` `true`) so anyone can mint.
2. Set **`redemptionHaircutBps`** high on the collateral pool (`update-asset-policy`) so redeem is obviously discounted. The public UI shows percent = bps / 100 (e.g. 2000 bps → 20%).
3. Optionally leave unwrap public, or flip unwrap private after the allowlist is ready.
4. **Before any private flag:** Controls → initialize allowlist PDA, then bulk-add wallets (one pubkey per line). On-chain max is **64** (`AllowlistFull`) — a protocol limit, not a UI cap. Empty/missing allowlist means only admin can wrap/unwrap.
5. Private wrap/unwrap txs use the allowlist PDA in the instruction slot before `collateral_token_program` and `florin_token_program`. Public (and admin) txs use the program-id sentinel in that same slot. A missing slot shifts the token programs and the program rejects the ix.

Private-wrap smoke: with `wrapPublic=false`, `POST /v1/tx/issue` for a non-member returns 400 `"not on allowlist"`; a member’s wrap ix has the allowlist PDA at account index 9 (not the program id). Public wrap (default localnet) uses the sentinel — see `wrap-stablecoin/scripts/backend_smoke.ts`.

## Monitoring

Run locally or in cron:

```bash
cd wrap-stablecoin && npx ts-node scripts/liquidity_check.ts
```

Exits non-zero when any pool has `freeLiquidity < liabilityUnderlying + cushion` (insufficient home backing for obligations).

## Admin dashboard

The operator console (`admin-frontend`) calls `/v1/admin/*`. See [Backend-API.md](Backend-API.md). Strings live in `admin-frontend/src/theme/copy.ts`.

### UI glossary

| Term | Meaning |
|---|---|
| **Swap Window** (`/`) | Issue / redeem via the admin wallet |
| **Reserves** (`/reserves`) | Collateral policy and backing |
| **Controls** (`/controls`) | Pause, wrap/unwrap, allowlist, admin / mint-authority handoff |
| **Yield** (`/yield`) | Kamino deploy / recall / harvest / sweep |
| **Treasury** (`/treasury`) | Withdraw treasury vault to an operator wallet + history |
| **Token Stats** (`/stats`) | Mint metadata and holders |
| **Admin** | Vault admin pubkey / signing wallet |

Legacy paths `/vault` and `/klend` redirect to `/controls` and `/yield`.

### Controls (`/controls`) — vault governance

Server-signed (admin keypair):

| Action | Route |
|---|---|
| Pause | `POST /v1/admin/set-paused` |
| Wrap / unwrap public | `POST /v1/admin/set-wrap-public`, `set-unwrap-public` |
| Init / add / remove allowlist | `POST /v1/admin/init-allowlist`, `add-to-allowlist` (`pubkey` or `pubkeys[]`), `remove-from-allowlist` |
| Propose / cancel admin transfer | `POST /v1/admin/transfer-authority`, `cancel-transfer-authority` |
| Propose / cancel mint authority | `POST /v1/admin/propose-mint-authority`, `cancel-propose-mint-authority` |

Destination-signed (keypair JSON in the browser; secret never sent to the backend):

| Action | Route |
|---|---|
| Accept admin | `POST /v1/admin/accept-authority/tx` |
| Accept mint authority (permanently disables wrap) | `POST /v1/admin/accept-mint-authority/tx` |

Mint-authority accept requires typing `DISABLE WRAP` in the UI. Remaining accounts (all `AssetConfig` PDAs) are attached by the backend.

### Reserves (`/reserves`) — collateral policy

Register assets, haircuts, caps, status, and Enable Kamino. The Accounts ledger sits under the heading on Swap Window, Reserves, Yield, and Treasury; actions follow below it.

Enable Kamino (per asset, one-shot) is `POST /v1/admin/enable-klend`.

### Yield (`/yield`) — Kamino ops

| Action | Route |
|---|---|
| Deploy amount | `POST /v1/admin/deposit-to-klend` |
| Deploy all (vault − cushion) | `POST /v1/admin/deposit-all-to-klend` |
| Recall amount | `POST /v1/admin/withdraw-from-klend` |
| Recall all | `POST /v1/admin/withdraw-all-from-klend` |
| Harvest | `POST /v1/admin/harvest-yield` |
| Sweep home surplus | `POST /v1/admin/sweep-home-surplus` |

**Harvestable** is live Kamino surplus (`kaminoSurplus` from `GET /v1/vault/assets`, marked after a simulated `refresh_reserve`). Harvest skims that yield into `treasury_vault` while principal stays in Kamino.

### Treasury (`/treasury`) — operator exit

| Action | Route |
|---|---|
| Withdraw treasury | `POST /v1/admin/withdraw-treasury` |
| Withdrawal history | `GET /v1/admin/withdraw-treasury/history` |

Pays tokens already in `treasury_vault` out of the protocol. Server-signed routes require `ADMIN_KEYPAIR_PATH` on the backend.

## Related

- [Accounting.md](Accounting.md)
- [Redemption.md](Redemption.md)
- [Backend-API.md](Backend-API.md)
