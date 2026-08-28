/**
 * Step 1: create test USDC mint + KLend lending market + reserve on devnet.
 * Idempotent-ish: reads devnet-state.json and skips completed pieces.
 * Usage: npx ts-node scripts/devnet/10_setup_market.ts
 */
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    createInitializeMintInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import Decimal from 'decimal.js'
import {
    adminKeypair,
    connection,
    kitSigner,
    KLEND_PROGRAM,
    PYTH_USDC_FEED,
    readState,
    RPC_URL,
    sendIxs,
    writeState,
} from './common'

const sdk = require('@kamino-finance/klend-sdk')
const { createSolanaRpc } = require('@solana/kit')

const DECIMALS = 6
const INITIAL_MINT = 10_000_000n * 10n ** 6n // 10M test USDC to admin

async function main() {
    const conn = connection()
    const admin = adminKeypair()
    const rpc = createSolanaRpc(RPC_URL)
    const state = readState()
    console.log('admin:', admin.publicKey.toBase58())

    // 1. Test USDC mint
    let usdcMint: PublicKey
    if (state.usdcMint) {
        usdcMint = new PublicKey(state.usdcMint)
        console.log('mint exists:', usdcMint.toBase58())
    } else {
        const mintKp = Keypair.generate()
        usdcMint = mintKp.publicKey
        const rent = await conn.getMinimumBalanceForRentExemption(MINT_SIZE)
        const ata = getAssociatedTokenAddressSync(usdcMint, admin.publicKey)
        await sendIxs(
            conn,
            [
                SystemProgram.createAccount({
                    fromPubkey: admin.publicKey,
                    newAccountPubkey: usdcMint,
                    space: MINT_SIZE,
                    lamports: rent,
                    programId: TOKEN_PROGRAM_ID,
                }),
                createInitializeMintInstruction(usdcMint, DECIMALS, admin.publicKey, null),
                createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata, admin.publicKey, usdcMint),
                createMintToInstruction(usdcMint, ata, admin.publicKey, INITIAL_MINT),
            ],
            admin,
            [mintKp],
            'create-mint',
        )
        writeState({ usdcMint: usdcMint.toBase58() })
        console.log('test USDC mint:', usdcMint.toBase58())
    }

    // 2. Lending market
    let market: PublicKey
    if (state.lendingMarket) {
        market = new PublicKey(state.lendingMarket)
        console.log('market exists:', market.toBase58())
    } else {
        const marketKp = Keypair.generate()
        market = marketKp.publicKey
        const size = sdk.LendingMarket.layout.span + 8
        const rent = await conn.getMinimumBalanceForRentExemption(size)
        const [marketAuthority] = await sdk.lendingMarketAuthPda(market.toBase58(), KLEND_PROGRAM.toBase58())
        const quoteCurrency = Array(32).fill(0)
        for (let i = 0; i < 3; i++) quoteCurrency[i] = 'USD'.charCodeAt(i)
        const initIx = sdk.initLendingMarket(
            { quoteCurrency },
            {
                lendingMarketOwner: kitSigner(admin.publicKey),
                lendingMarket: market.toBase58(),
                lendingMarketAuthority: marketAuthority,
                systemProgram: SystemProgram.programId.toBase58(),
                rent: SYSVAR_RENT_PUBKEY.toBase58(),
            },
        )
        await sendIxs(
            conn,
            [
                SystemProgram.createAccount({
                    fromPubkey: admin.publicKey,
                    newAccountPubkey: market,
                    space: size,
                    lamports: rent,
                    programId: KLEND_PROGRAM,
                }),
                initIx,
            ],
            admin,
            [marketKp],
            'init-market',
        )
        writeState({ lendingMarket: market.toBase58() })
        console.log('lending market:', market.toBase58())
    }

    // 3. Reserve
    let reserve: PublicKey
    if (state.reserve) {
        reserve = new PublicKey(state.reserve)
        console.log('reserve exists:', reserve.toBase58())
    } else {
        const reserveKp = Keypair.generate()
        reserve = reserveKp.publicKey
        const adminAta = getAssociatedTokenAddressSync(usdcMint, admin.publicKey)
        const createIxs = await sdk.createReserveIxs(
            rpc,
            kitSigner(admin.publicKey),
            adminAta.toBase58(),
            market.toBase58(),
            usdcMint.toBase58(),
            TOKEN_PROGRAM_ID.toBase58(),
            { address: reserve.toBase58() },
            KLEND_PROGRAM.toBase58(),
        )
        await sendIxs(conn, createIxs, admin, [reserveKp], 'init-reserve')
        const pdas = await sdk.reservePdas(KLEND_PROGRAM.toBase58(), reserve.toBase58())
        writeState({
            reserve: reserve.toBase58(),
            reserveLiquiditySupply: pdas.liquiditySupplyVault.toString(),
            reserveCollateralMint: pdas.collateralMint.toString(),
        })
        console.log('reserve:', reserve.toBase58())
    }

    // 4. Reserve config: pyth oracle, generous limits, aggressive borrow curve for fast yield
    const cfg = new sdk.AssetReserveConfig({
        mint: usdcMint.toBase58(),
        tokenName: 'tUSDC',
        mintDecimals: DECIMALS,
        mintTokenProgram: TOKEN_PROGRAM_ID.toBase58(),
        priceFeed: { pythPrice: PYTH_USDC_FEED.toBase58() },
        loanToValuePct: 75,
        liquidationThresholdPct: 85,
        depositLimit: new Decimal(1_000_000_000),
        borrowLimit: new Decimal(1_000_000_000),
        borrowRateCurve: new sdk.BorrowRateCurve({
            points: [
                new sdk.CurvePoint({ utilizationRateBps: 0, borrowRateBps: 50000 }),
                new sdk.CurvePoint({ utilizationRateBps: 10000, borrowRateBps: 100000 }),
                ...Array(9).fill(new sdk.CurvePoint({ utilizationRateBps: 10000, borrowRateBps: 100000 })),
            ],
        }),
    })
    cfg.assetReserveConfigParams.maxAgePriceSeconds = 3600
    // SDK default is 0, which KLend treats as a hard cap of zero -> BorrowLimitExceeded
    cfg.assetReserveConfigParams.borrowLimitOutsideElevationGroup = new Decimal(1_000_000_000)

    const manager = new sdk.KaminoManager(rpc, undefined, KLEND_PROGRAM.toBase58(), undefined)
    const marketState = await sdk.LendingMarket.fetch(rpc, market.toBase58(), KLEND_PROGRAM.toBase58())
    const configIxs = await manager.updateReserveIxs(
        kitSigner(admin.publicKey),
        { address: market.toBase58(), state: marketState },
        reserve.toBase58(),
        cfg.getReserveConfig(),
    )
    const sendable = configIxs.filter((c: any) => !c.requiresGlobalAdmin).map((c: any) => c.ix)
    const skipped = configIxs.length - sendable.length
    console.log(`config update: ${sendable.length} ixs (${skipped} skipped, require global admin)`)
    // send in small chunks to stay under tx size
    for (let i = 0; i < sendable.length; i += 4) {
        await sendIxs(conn, sendable.slice(i, i + 4), admin, [], `config-${i}`)
    }

    // updateReserveIxs's differ misses borrowLimitOutsideElevationGroup; set it directly.
    // KLend enforces it as a hard cap, and 0 blocks every borrow.
    const types = require('@kamino-finance/klend-sdk/dist/@codegen/klend/types')
    const limitBuf = Buffer.alloc(8)
    limitBuf.writeBigUInt64LE(1_000_000_000n * 10n ** 6n)
    const outsideLimitIx = await sdk.updateReserveConfigIx(
        kitSigner(admin.publicKey),
        market.toBase58(),
        reserve.toBase58(),
        new types.UpdateConfigMode.UpdateBorrowLimitOutsideElevationGroup(),
        limitBuf,
        KLEND_PROGRAM.toBase58(),
    )
    await sendIxs(conn, [outsideLimitIx], admin, [], 'config-outside-limit')
    console.log('done. state:', readState())
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
