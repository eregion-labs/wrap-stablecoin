/**
 * Admin utility: move vault liquidity into KLend so it earns yield.
 * Usage: npx ts-node scripts/devnet/50_klend_deposit.ts [base_units]  (default 50k tUSDC)
 */
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, PYTH_USDC_FEED, readState, sighash } from './common'

const IDL = require('../../target/idl/kamino_tester.json')

async function main() {
    const amount = new anchor.BN(process.argv[2] ?? 50_000_000_000)
    const st = readState()
    const conn = connection()
    const admin = adminKeypair()
    const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(admin), { commitment: 'confirmed' })
    anchor.setProvider(provider)
    const program = new anchor.Program(IDL as anchor.Idl, provider)

    const market = new PublicKey(st.lendingMarket!)
    const reserve = new PublicKey(st.reserve!)
    const lendingMarketAuthority = PublicKey.findProgramAddressSync([Buffer.from('lma'), market.toBuffer()], KLEND_PROGRAM)[0]
    const refreshIx = new TransactionInstruction({
        programId: KLEND_PROGRAM,
        keys: [
            { pubkey: reserve, isSigner: false, isWritable: true },
            { pubkey: market, isSigner: false, isWritable: false },
            { pubkey: PYTH_USDC_FEED, isSigner: false, isWritable: false },
            { pubkey: KLEND_PROGRAM, isSigner: false, isWritable: false },
            { pubkey: KLEND_PROGRAM, isSigner: false, isWritable: false },
            { pubkey: KLEND_PROGRAM, isSigner: false, isWritable: false },
        ],
        data: sighash('refresh_reserve'),
    })

    const sig = await program.methods
        .depositToKlend({ amount } as any)
        .accountsPartial({
            admin: admin.publicKey,
            vaultConfig: new PublicKey(st.vaultConfig!),
            vaultAuthority: new PublicKey(st.vaultAuthority!),
            tokenConfig: new PublicKey(st.tokenConfig!),
            tokenVault: new PublicKey(st.tokenVault!),
            usdcMint: new PublicKey(st.usdcMint!),
            klendProgram: KLEND_PROGRAM,
            lendingMarket: market,
            lendingMarketAuthority,
            baseReserve: reserve,
            reserveLiquiditySupply: new PublicKey(st.reserveLiquiditySupply!),
            reserveCollateralMint: new PublicKey(st.reserveCollateralMint!),
            baseCollateralVault: new PublicKey(st.collateralVault!),
            tokenProgram: TOKEN_PROGRAM_ID,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .preInstructions([refreshIx])
        .rpc()
    console.log(`deposited ${amount.toString()} base units into KLend: ${sig}`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
