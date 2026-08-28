/**
 * Step 2: initialize the wrap_stablecoin vault and register both collaterals
 * against their devnet KLend reserves. initialize -> add_asset(A) -> enable_klend(A)
 * -> add_asset(B) -> enable_klend(B). Idempotent.
 * Usage: npx ts-node scripts/devnet-e2e/20_seed_vault.ts
 */
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, lmaPda, readState, WRAP_PROGRAM, writeState } from './common'

const IDL = require('../../target/idl/wrap_stablecoin.json')

const S = {
    vaultConfig: Buffer.from('vault_config'),
    vaultAuthority: Buffer.from('vault_authority'),
    wrappedMint: Buffer.from('wrapped_mint'),
    assetConfig: Buffer.from('token_config'), // seed string kept for account compat
    tokenVault: Buffer.from('token_vault'),
    treasuryVault: Buffer.from('treasury_vault'),
    collateralVault: Buffer.from('token_collateral_vault'),
    klendConfig: Buffer.from('klend_config'),
}
const pda = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, WRAP_PROGRAM)[0]

async function main() {
    const conn = connection()
    const admin = adminKeypair()
    const state = readState()
    const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(admin), { commitment: 'confirmed' })
    anchor.setProvider(provider)
    const program = new anchor.Program(IDL as anchor.Idl, provider)
    const market = new PublicKey(state.lendingMarket!)

    const vaultConfig = pda([S.vaultConfig, admin.publicKey.toBuffer()])
    const vaultAuthority = pda([S.vaultAuthority, vaultConfig.toBuffer()])
    const wrappedMint = pda([S.wrappedMint, vaultConfig.toBuffer()])

    // decimals for the Florin mint taken from asset A's mint
    const decimalsMint = new PublicKey(state.assets.A.mint!)

    if (await conn.getAccountInfo(vaultConfig)) {
        console.log('vault_config exists — skip initialize')
    } else {
        const sig = await program.methods
            .initialize()
            .accountsPartial({
                authority: admin.publicKey,
                decimalsMint,
                vaultConfig,
                wrappedMint,
                vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .rpc()
        console.log('initialize tx', sig)
    }
    state.vaultConfig = vaultConfig.toBase58()
    state.vaultAuthority = vaultAuthority.toBase58()
    state.wrappedMint = wrappedMint.toBase58()
    writeState(state)

    for (const key of Object.keys(state.assets)) {
        const a = state.assets[key]
        const mint = new PublicKey(a.mint!)
        const assetConfig = pda([S.assetConfig, vaultConfig.toBuffer(), mint.toBuffer()])
        const tokenVault = pda([S.tokenVault, assetConfig.toBuffer()])
        const treasuryVault = pda([S.treasuryVault, assetConfig.toBuffer()])
        const collateralVault = pda([S.collateralVault, assetConfig.toBuffer()])
        const klendConfig = pda([S.klendConfig, assetConfig.toBuffer()])

        if (await conn.getAccountInfo(assetConfig)) {
            console.log(`${a.symbol} asset_config exists — skip add_asset`)
        } else {
            const sig = await program.methods
                .addAsset({ mintEnabled: true, redeemEnabled: true } as any)
                .accountsPartial({
                    admin: admin.publicKey,
                    vaultConfig,
                    vaultAuthority,
                    underlyingMint: mint,
                    assetConfig,
                    tokenVault,
                    treasuryVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc()
            console.log(`${a.symbol} add_asset tx`, sig)
        }

        if (await conn.getAccountInfo(klendConfig)) {
            console.log(`${a.symbol} klend_config exists — skip enable_klend`)
        } else {
            const sig = await program.methods
                .enableKlend()
                .accountsPartial({
                    admin: admin.publicKey,
                    vaultConfig,
                    vaultAuthority,
                    assetConfig,
                    klendConfig,
                    lendingMarket: market,
                    lendingMarketAuthority: lmaPda(market),
                    reserve: new PublicKey(a.reserve!),
                    reserveLiquiditySupply: new PublicKey(a.reserveLiquiditySupply!),
                    collateralMint: new PublicKey(a.reserveCollateralMint!),
                    collateralVault,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc()
            console.log(`${a.symbol} enable_klend tx`, sig)
        }

        Object.assign(a, {
            assetConfig: assetConfig.toBase58(),
            tokenVault: tokenVault.toBase58(),
            treasuryVault: treasuryVault.toBase58(),
            collateralVault: collateralVault.toBase58(),
            klendConfig: klendConfig.toBase58(),
        })
        writeState(state)
    }

    console.log('done. state:', JSON.stringify(readState(), null, 2))
}

main().catch((e) => {
    console.error(e)
    if (e.logs) console.error(e.logs.slice(-15).join('\n'))
    process.exit(1)
})
