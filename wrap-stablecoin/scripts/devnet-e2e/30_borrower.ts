/**
 * Step 3: per-asset borrower that deposits collateral and borrows, driving that
 * reserve's utilization > 0 so supply interest (yield) accrues for the vault.
 * Usage: npx ts-node scripts/devnet-e2e/30_borrower.ts <A|B>
 */
import * as fs from 'fs'
import * as path from 'path'
import { Keypair, PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js'
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, patchAsset, readState, refreshReserveIx, sendIxs } from './common'

const sdk = require('@kamino-finance/klend-sdk')
const BN = require('bn.js')

const COLLATERAL = 200_000n * 10n ** 6n
const BORROW = 150_000n * 10n ** 6n

async function hasActiveDeposits(conn: any, obligation: PublicKey): Promise<boolean> {
    const info = await conn.getAccountInfo(obligation)
    if (!info) return false
    const ob = sdk.Obligation.decode(Buffer.from(info.data))
    return ob.deposits.some((d: any) => d.depositReserve.toString() !== '11111111111111111111111111111111')
}

function borrowerKeypair(key: string): Keypair {
    const file = path.join(__dirname, `borrower-${key}.json`)
    if (fs.existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))))
    const kp = Keypair.generate()
    fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)))
    return kp
}

async function main() {
    const key = (process.argv[2] ?? 'A').toUpperCase()
    const state = readState()
    const a = state.assets[key]
    if (!a?.reserve) throw new Error(`asset ${key} has no reserve; run 10_setup_market first`)
    const conn = connection()
    const admin = adminKeypair()
    const borrower = borrowerKeypair(key)
    const mint = new PublicKey(a.mint!)
    const market = new PublicKey(state.lendingMarket!)
    const reserve = new PublicKey(a.reserve!)
    const reserveLiquiditySupply = new PublicKey(a.reserveLiquiditySupply!)
    const reserveCollateralMint = new PublicKey(a.reserveCollateralMint!)
    const sentinel = KLEND_PROGRAM.toBase58()
    console.log(`[${a.symbol}] borrower:`, borrower.publicKey.toBase58())

    // 1. fund borrower with SOL + test token
    const borrowerAta = getAssociatedTokenAddressSync(mint, borrower.publicKey)
    const bal = await conn.getBalance(borrower.publicKey)
    const fundIxs: TransactionInstruction[] = []
    if (bal < 30_000_000) fundIxs.push(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: borrower.publicKey, lamports: 50_000_000 }))
    fundIxs.push(
        createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, borrowerAta, borrower.publicKey, mint),
        createMintToInstruction(mint, borrowerAta, admin.publicKey, COLLATERAL),
    )
    await sendIxs(conn, fundIxs, admin, [], 'fund-borrower')

    // 2. user metadata + obligation
    const [userMetadata] = await sdk.userMetadataPda(borrower.publicKey.toBase58(), KLEND_PROGRAM.toBase58())
    const obligationPda = await sdk.getObligationPdaWithArgs(
        market.toBase58(),
        borrower.publicKey.toBase58(),
        { tag: 0, id: 0, seed1: SystemProgram.programId.toBase58(), seed2: SystemProgram.programId.toBase58() },
        KLEND_PROGRAM.toBase58(),
    )
    const obligation = new PublicKey(obligationPda.toString())

    const setupIxs: any[] = []
    if (!(await conn.getAccountInfo(new PublicKey(userMetadata.toString())))) {
        setupIxs.push(
            sdk.initUserMetadata(
                { userLookupTable: SystemProgram.programId.toBase58() },
                { owner: { address: borrower.publicKey.toBase58() }, feePayer: { address: borrower.publicKey.toBase58() }, userMetadata: userMetadata.toString(), referrerUserMetadata: sentinel, rent: SYSVAR_RENT_PUBKEY.toBase58(), systemProgram: SystemProgram.programId.toBase58() },
            ),
        )
    }
    if (!(await conn.getAccountInfo(obligation))) {
        setupIxs.push(
            sdk.initObligation(
                { args: { tag: 0, id: 0 } },
                { obligationOwner: { address: borrower.publicKey.toBase58() }, feePayer: { address: borrower.publicKey.toBase58() }, obligation: obligation.toBase58(), lendingMarket: market.toBase58(), seed1Account: SystemProgram.programId.toBase58(), seed2Account: SystemProgram.programId.toBase58(), ownerUserMetadata: userMetadata.toString(), rent: SYSVAR_RENT_PUBKEY.toBase58(), systemProgram: SystemProgram.programId.toBase58() },
            ),
        )
    }
    if (setupIxs.length) await sendIxs(conn, setupIxs, borrower, [], 'init-obligation')

    // 3. deposit collateral
    const [lma] = await sdk.lendingMarketAuthPda(market.toBase58(), KLEND_PROGRAM.toBase58())
    const [collateralSupply] = await sdk.reserveCollateralSupplyPda(reserve.toBase58(), KLEND_PROGRAM.toBase58())
    const depositIx = sdk.depositReserveLiquidityAndObligationCollateral(
        { liquidityAmount: new BN(COLLATERAL.toString()) },
        {
            owner: { address: borrower.publicKey.toBase58() }, obligation: obligation.toBase58(), lendingMarket: market.toBase58(), lendingMarketAuthority: lma,
            reserve: reserve.toBase58(), reserveLiquidityMint: mint.toBase58(), reserveLiquiditySupply: reserveLiquiditySupply.toBase58(), reserveCollateralMint: reserveCollateralMint.toBase58(),
            reserveDestinationDepositCollateral: collateralSupply, userSourceLiquidity: borrowerAta.toBase58(), placeholderUserDestinationCollateral: sentinel,
            collateralTokenProgram: TOKEN_PROGRAM_ID.toBase58(), liquidityTokenProgram: TOKEN_PROGRAM_ID.toBase58(), instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
        },
    )
    const hasDeposits = await hasActiveDeposits(conn, obligation)
    const refreshObPre = sdk.refreshObligation({ lendingMarket: market.toBase58(), obligation: obligation.toBase58() }, hasDeposits ? [{ address: reserve.toBase58(), role: 1 }] : [])
    await sendIxs(conn, [refreshReserveIx(reserve, market), refreshObPre, depositIx], borrower, [], 'deposit-collateral')

    // 4. borrow
    const [feeReceiver] = await sdk.reserveFeeVaultPda(reserve.toBase58(), KLEND_PROGRAM.toBase58())
    const refreshObIx = sdk.refreshObligation({ lendingMarket: market.toBase58(), obligation: obligation.toBase58() }, [{ address: reserve.toBase58(), role: 1 }])
    const borrowIx = sdk.borrowObligationLiquidity(
        { liquidityAmount: new BN(BORROW.toString()) },
        {
            owner: { address: borrower.publicKey.toBase58() }, obligation: obligation.toBase58(), lendingMarket: market.toBase58(), lendingMarketAuthority: lma,
            borrowReserve: reserve.toBase58(), borrowReserveLiquidityMint: mint.toBase58(), reserveSourceLiquidity: reserveLiquiditySupply.toBase58(), borrowReserveLiquidityFeeReceiver: feeReceiver,
            userDestinationLiquidity: borrowerAta.toBase58(), referrerTokenState: sentinel, tokenProgram: TOKEN_PROGRAM_ID.toBase58(), instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
        },
    )
    await sendIxs(conn, [refreshReserveIx(reserve, market), refreshObIx, borrowIx], borrower, [], 'borrow')

    const resInfo = await conn.getAccountInfo(reserve)
    const res = sdk.Reserve.decode(Buffer.from(resInfo!.data))
    console.log(`[${a.symbol}] available:`, res.liquidity.availableAmount.toString(), 'borrowedSf:', res.liquidity.borrowedAmountSf.toString().slice(0, 10))
    patchAsset(key, { borrower: borrower.publicKey.toBase58(), obligation: obligation.toBase58() })
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
