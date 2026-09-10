/**
 * Step 2: initialize the wrap_stablecoin vault and register A/B collaterals
 * against their devnet KLend reserves, via the same `cli init` the real deploy
 * uses. Idempotent.
 * Numbered dummies (tUSD1, …) are intentionally skipped — register them on the
 * admin Reserves page after copying the mint from 10_setup_market.
 * Usage: npx ts-node scripts/devnet-e2e/20_seed_vault.ts
 */
import { init } from '../../cli/commands/init'
import { readState, VAULT_ASSET_KEYS, writeState } from './common'

async function main() {
    const state = readState()
    /** Florin decimals come from the first collateral; ignored on later calls. */
    const decimalsMint = state.assets[VAULT_ASSET_KEYS[0]]?.mint
    if (!decimalsMint) throw new Error('asset A has no mint; run 10_setup_market first')

    for (const key of VAULT_ASSET_KEYS) {
        const asset = state.assets[key]
        if (!asset?.mint || !asset.reserve) {
            throw new Error(`asset ${key} incomplete; run 10_setup_market first`)
        }
        console.log(`─── ${asset.symbol} ───`)
        const deployment = await init({
            network: 'devnet',
            decimalsMint,
            asset: asset.mint,
            reserve: asset.reserve,
            dryRun: false,
        })
        const registered = deployment.assets[asset.mint]

        state.vaultConfig = deployment.vaultConfig
        state.vaultAuthority = deployment.vaultAuthority
        state.wrappedMint = deployment.wrappedMint
        asset.assetConfig = registered.assetConfig
        asset.tokenVault = registered.tokenVault
        asset.treasuryVault = registered.treasuryVault
        asset.collateralVault = registered.collateralVault
        asset.klendConfig = registered.klendConfig
        writeState(state)
    }

    console.log('done. state:', JSON.stringify(readState(), null, 2))
}

main().catch((e) => {
    console.error(e)
    if (e.logs) console.error(e.logs.slice(-15).join('\n'))
    process.exit(1)
})
