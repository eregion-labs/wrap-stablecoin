/**
 * Step 3: create a borrower that deposits collateral and borrows tUSDC,
 * driving reserve utilization > 0 so interest (yield) accrues for depositors.
 * Usage: npx ts-node scripts/devnet/30_borrower.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { Keypair, PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, readState, sendIxs, sighash, writeState } from './common'

const sdk = require('@kamino-finance/klend-sdk')
const BN = require('bn.js')

const BORROWER_FILE = path.join(__dirname, 'borrower.json')
const COLLATERAL = 200_000n * 10n ** 6n // 200k tUSDC collateral
const BORROW = 150_000n * 10n ** 6n // 150k tUSDC borrow -> ~75% utilization

async function hasActiveDeposits(conn: any, obligation: PublicKey): Promise<boolean> {
    const info = await conn.getAccountInfo(obligation)
    if (!info) return false
    const ob = sdk.Obligation.decode(Buffer.from(info.data))
    return ob.deposits.some((d: any) => d.depositReserve.toString() !== '11111111111111111111111111111111')
}

function loadOrCreateBorrower(): Keypair {
    if (fs.existsSync(BORROWER_FILE)) {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(BORROWER_FILE, 'utf8'))))
    }
    const kp = Keypair.generate()
    fs.writeFileSync(BORROWER_FILE, JSON.stringify(Array.from(kp.secretKey)))
    return kp
}

function refreshReserveIx(reserve: PublicKey, market: PublicKey, pyth: PublicKey): TransactionInstruction {
    const sentinel = KLEND_PROGRAM
    return new TransactionInstruction({
        programId: KLEND_PROGRAM,
        keys: [
            { pubkey: reserve, isSigner: false, isWritable: true },
            { pubkey: market, isSigner: false, isWritable: false },
            { pubkey: pyth, isSigner: false, isWritable: false },
            { pubkey: sentinel, isSigner: false, isWritable: false },
            { pubkey: sentinel, isSigner: false, isWritable: false },
            { pubkey: sentinel, isSigner: false, isWritable: false },
        ],
        data: sighash('refresh_reserve'),
    })
}

async function main() {
    const state = readState()
    const conn = connection()
    const admin = adminKeypair()
    const borrower = loadOrCreateBorrower()
    const usdcMint = new PublicKey(state.usdcMint!)
    const market = new PublicKey(state.lendingMarket!)
    const reserve = new PublicKey(state.reserve!)
    const reserveLiquiditySupply = new PublicKey(state.reserveLiquiditySupply!)
    const reserveCollateralMint = new PublicKey(state.reserveCollateralMint!)
    const pyth = new PublicKey('Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX')
    const sentinel = KLEND_PROGRAM.toBase58()
    console.log('borrower:', borrower.publicKey.toBase58())

    // 1. fund borrower with SOL + tUSDC
    const borrowerAta = getAssociatedTokenAddressSync(usdcMint, borrower.publicKey)
    const bal = await conn.getBalance(borrower.publicKey)
    const ixs: TransactionInstruction[] = []
    if (bal < 30_000_000) {
        ixs.push(
            SystemProgram.transfer({
                fromPubkey: admin.publicKey,
                toPubkey: borrower.publicKey,
                lamports: 50_000_000,
            }),
        )
    }
    ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, borrowerAta, borrower.publicKey, usdcMint),
        createMintToInstruction(usdcMint, borrowerAta, admin.publicKey, COLLATERAL),
    )
    await sendIxs(conn, ixs, admin, [], 'fund-borrower')

    // 2. user metadata + obligation
    const [userMetadata] = await sdk.userMetadataPda(borrower.publicKey.toBase58(), KLEND_PROGRAM.toBase58())
    const obligationPda = await sdk.getObligationPdaWithArgs(
        market.toBase58(),
        borrower.publicKey.toBase58(),
        { tag: 0, id: 0, seed1: SystemProgram.programId.toBase58(), seed2: SystemProgram.programId.toBase58() },
        KLEND_PROGRAM.toBase58(),
    )
    const obligation = new PublicKey(obligationPda.toString())
    console.log('obligation:', obligation.toBase58())

    const setupIxs: any[] = []
    if (!(await conn.getAccountInfo(new PublicKey(userMetadata.toString())))) {
        setupIxs.push(
            sdk.initUserMetadata(
                { userLookupTable: SystemProgram.programId.toBase58() },
                {
                    owner: { address: borrower.publicKey.toBase58() },
                    feePayer: { address: borrower.publicKey.toBase58() },
                    userMetadata: userMetadata.toString(),
                    referrerUserMetadata: sentinel,
                    rent: SYSVAR_RENT_PUBKEY.toBase58(),
                    systemProgram: SystemProgram.programId.toBase58(),
                },
            ),
        )
    }
    if (!(await conn.getAccountInfo(obligation))) {
        setupIxs.push(
            sdk.initObligation(
                { args: { tag: 0, id: 0 } },
                {
                    obligationOwner: { address: borrower.publicKey.toBase58() },
                    feePayer: { address: borrower.publicKey.toBase58() },
                    obligation: obligation.toBase58(),
                    lendingMarket: market.toBase58(),
                    seed1Account: SystemProgram.programId.toBase58(),
                    seed2Account: SystemProgram.programId.toBase58(),
                    ownerUserMetadata: userMetadata.toString(),
                    rent: SYSVAR_RENT_PUBKEY.toBase58(),
                    systemProgram: SystemProgram.programId.toBase58(),
                },
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
            owner: { address: borrower.publicKey.toBase58() },
            obligation: obligation.toBase58(),
            lendingMarket: market.toBase58(),
            lendingMarketAuthority: lma,
            reserve: reserve.toBase58(),
            reserveLiquidityMint: usdcMint.toBase58(),
            reserveLiquiditySupply: reserveLiquiditySupply.toBase58(),
            reserveCollateralMint: reserveCollateralMint.toBase58(),
            reserveDestinationDepositCollateral: collateralSupply,
            userSourceLiquidity: borrowerAta.toBase58(),
            placeholderUserDestinationCollateral: sentinel,
            collateralTokenProgram: TOKEN_PROGRAM_ID.toBase58(),
            liquidityTokenProgram: TOKEN_PROGRAM_ID.toBase58(),
            instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
        },
    )
    const obligationInfo = await conn.getAccountInfo(obligation)
    // refresh_obligation needs the obligation's deposited reserves as remaining accounts;
    // on the very first deposit the obligation is empty, so none are passed
    const hasDeposits = obligationInfo !== null && (await hasActiveDeposits(conn, obligation))
    const refreshObligationPre = sdk.refreshObligation(
        { lendingMarket: market.toBase58(), obligation: obligation.toBase58() },
        hasDeposits ? [{ address: reserve.toBase58(), role: 1 }] : [],
    )
    await sendIxs(
        conn,
        [refreshReserveIx(reserve, market, pyth), refreshObligationPre, depositIx],
        borrower,
        [],
        'deposit-collateral',
    )

    // 4. borrow
    const [feeReceiver] = await sdk.reserveFeeVaultPda(reserve.toBase58(), KLEND_PROGRAM.toBase58())
    const refreshObligationIx = sdk.refreshObligation(
        { lendingMarket: market.toBase58(), obligation: obligation.toBase58() },
        [{ address: reserve.toBase58(), role: 1 }],
    )
    const borrowIx = sdk.borrowObligationLiquidity(
        { liquidityAmount: new BN(BORROW.toString()) },
        {
            owner: { address: borrower.publicKey.toBase58() },
            obligation: obligation.toBase58(),
            lendingMarket: market.toBase58(),
            lendingMarketAuthority: lma,
            borrowReserve: reserve.toBase58(),
            borrowReserveLiquidityMint: usdcMint.toBase58(),
            reserveSourceLiquidity: reserveLiquiditySupply.toBase58(),
            borrowReserveLiquidityFeeReceiver: feeReceiver,
            userDestinationLiquidity: borrowerAta.toBase58(),
            referrerTokenState: sentinel,
            tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
            instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
        },
    )
    await sendIxs(
        conn,
        [refreshReserveIx(reserve, market, pyth), refreshObligationIx, borrowIx],
        borrower,
        [],
        'borrow',
    )

    // 5. report utilization
    const resInfo = await conn.getAccountInfo(reserve)
    const res = sdk.Reserve.decode(Buffer.from(resInfo!.data))
    console.log('available:', res.liquidity.availableAmount.toString())
    console.log('borrowedSf:', res.liquidity.borrowedAmountSf.toString())
    writeState({ borrower: borrower.publicKey.toBase58(), obligation: obligation.toBase58() })
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
