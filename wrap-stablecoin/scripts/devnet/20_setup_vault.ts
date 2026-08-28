/**
 * Step 2: initialize the wrap vault against the devnet KLend reserve from step 1.
 * Usage: npx ts-node scripts/devnet/20_setup_vault.ts
 */
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, readState, WRAP_PROGRAM, writeState } from './common'

const IDL = require('../../target/idl/kamino_tester.json')

function pda(seeds: (Buffer | Uint8Array)[], programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(seeds, programId)[0]
}

async function main() {
    const state = readState()
    if (!state.usdcMint || !state.lendingMarket || !state.reserve) {
        throw new Error('run 10_setup_market.ts first')
    }
    const conn = connection()
    const admin = adminKeypair()
    const usdcMint = new PublicKey(state.usdcMint)
    const market = new PublicKey(state.lendingMarket)
    const reserve = new PublicKey(state.reserve)
    const reserveLiquiditySupply = new PublicKey(state.reserveLiquiditySupply!)
    const collateralMint = new PublicKey(state.reserveCollateralMint!)

    const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(admin), { commitment: 'confirmed' })
    anchor.setProvider(provider)
    const program = new anchor.Program(IDL as anchor.Idl, provider)

    const vaultConfig = pda([Buffer.from('vault_config'), admin.publicKey.toBuffer()], WRAP_PROGRAM)
    const vaultAuthority = pda([Buffer.from('vault_authority'), vaultConfig.toBuffer()], WRAP_PROGRAM)
    const wrappedMint = pda([Buffer.from('wrapped_mint'), vaultConfig.toBuffer()], WRAP_PROGRAM)
    const tokenConfig = pda([Buffer.from('token_config'), vaultConfig.toBuffer(), usdcMint.toBuffer()], WRAP_PROGRAM)
    const collateralVault = pda([Buffer.from('token_collateral_vault'), tokenConfig.toBuffer()], WRAP_PROGRAM)
    const tokenVault = pda([Buffer.from('token_vault'), tokenConfig.toBuffer()], WRAP_PROGRAM)
    const lendingMarketAuthority = pda([Buffer.from('lma'), market.toBuffer()], KLEND_PROGRAM)
    const treasury = getAssociatedTokenAddressSync(usdcMint, vaultAuthority, true)

    const existing = await conn.getAccountInfo(vaultConfig)
    if (existing) {
        console.log('vault_config already initialized:', vaultConfig.toBase58())
    } else {
        const treasuryIx = createAssociatedTokenAccountIdempotentInstruction(
            admin.publicKey,
            treasury,
            vaultAuthority,
            usdcMint,
        )
        const sig = await program.methods
            .initialize()
            .accountsPartial({
                authority: admin.publicKey,
                usdcMint,
                vaultConfig,
                wrappedMint,
                vaultAuthority,
                lendingMarket: market,
                lendingMarketAuthority,
                treasury,
                reserve,
                reserveLiquiditySupply,
                collateralMint,
                tokenConfig,
                collateralVault,
                tokenVault,
                tokenProgram: TOKEN_PROGRAM_ID,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .preInstructions([treasuryIx])
            .rpc()
        console.log('initialize tx:', sig)
    }

    writeState({
        vaultConfig: vaultConfig.toBase58(),
        vaultAuthority: vaultAuthority.toBase58(),
        wrappedMint: wrappedMint.toBase58(),
        tokenConfig: tokenConfig.toBase58(),
        tokenVault: tokenVault.toBase58(),
        collateralVault: collateralVault.toBase58(),
        treasury: treasury.toBase58(),
    })
    console.log('vault state saved:', readState())
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
