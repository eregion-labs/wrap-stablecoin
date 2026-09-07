/**
 * Step 1: create a shared KLend lending market + one reserve per test collateral
 * on devnet, each with a pyth oracle and an aggressive borrow curve.
 * Idempotent: skips pieces already recorded in devnet-state.json.
 *
 * Usage:
 *   npx ts-node scripts/devnet-e2e/10_setup_market.ts          # ensure A/B (and any existing state assets)
 *   npx ts-node scripts/devnet-e2e/10_setup_market.ts 1 2 3    # add tUSD1, tUSD2, tUSD3 on the same market
 */
import { Keypair, PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
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
    assetStatus,
    connection,
    ensureNumberedAssets,
    kitSigner,
    KLEND_PROGRAM,
    numberedSymbol,
    parseNumberedArgs,
    printAssetRegistry,
    PYTH_USDC_FEED,
    readState,
    RPC_URL,
    sendIxs,
    writeState,
} from './common'

const sdk = require('@kamino-finance/klend-sdk')
const { createSolanaRpc } = require('@solana/kit')

const INITIAL_MINT = 10_000_000n * 10n ** 6n // 10M of each test token to admin

/** Devnet KLend now requires instruction_sysvar last; SDK 7.x IDL omits it. */
function withIxSysvar(ix: any): any {
    if (!ix?.accounts) return ix
    const sysvar = SYSVAR_INSTRUCTIONS_PUBKEY.toBase58()
    if (!ix.accounts.some((a: any) => a.address === sysvar)) {
        ix.accounts.push({ address: sysvar, role: 0 })
    }
    return ix
}

async function ensureMint(conn: any, admin: Keypair, symbol: string, decimals: number): Promise<PublicKey> {
    const mintKp = Keypair.generate()
    const mint = mintKp.publicKey
    const rent = await conn.getMinimumBalanceForRentExemption(MINT_SIZE)
    const ata = getAssociatedTokenAddressSync(mint, admin.publicKey)
    await sendIxs(
        conn,
        [
            SystemProgram.createAccount({ fromPubkey: admin.publicKey, newAccountPubkey: mint, space: MINT_SIZE, lamports: rent, programId: TOKEN_PROGRAM_ID }),
            createInitializeMintInstruction(mint, decimals, admin.publicKey, null),
            createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata, admin.publicKey, mint),
            createMintToInstruction(mint, ata, admin.publicKey, INITIAL_MINT),
        ],
        admin,
        [mintKp],
        `mint-${symbol}`,
    )
    return mint
}

async function ensureReserve(conn: any, rpc: any, admin: Keypair, market: PublicKey, mint: PublicKey, symbol: string, decimals: number) {
    const reserveKp = Keypair.generate()
    const reserve = reserveKp.publicKey
    const adminAta = getAssociatedTokenAddressSync(mint, admin.publicKey)
    const createIxs = await sdk.createReserveIxs(
        rpc,
        kitSigner(admin.publicKey),
        adminAta.toBase58(),
        market.toBase58(),
        mint.toBase58(),
        TOKEN_PROGRAM_ID.toBase58(),
        { address: reserve.toBase58() },
        KLEND_PROGRAM.toBase58(),
    )
    // Devnet KLend InitReserve / UpdateReserveConfig require instruction_sysvar; SDK 7.x omits it.
    for (const ix of createIxs) withIxSysvar(ix)
    await sendIxs(conn, createIxs, admin, [reserveKp], `reserve-${symbol}`)
    const pdas = await sdk.reservePdas(KLEND_PROGRAM.toBase58(), reserve.toBase58())

    // config: pyth oracle, generous limits, 500%->1000% APR curve for fast yield
    const cfg = new sdk.AssetReserveConfig({
        mint: mint.toBase58(),
        tokenName: symbol,
        mintDecimals: decimals,
        mintTokenProgram: TOKEN_PROGRAM_ID.toBase58(),
        priceFeed: { pythPrice: PYTH_USDC_FEED.toBase58() },
        loanToValuePct: 75,
        liquidationThresholdPct: 85,
        depositLimit: new Decimal(1_000_000_000),
        borrowLimit: new Decimal(1_000_000_000),
        borrowRateCurve: new sdk.BorrowRateCurve({
            points: [
                new sdk.CurvePoint({ utilizationRateBps: 0, borrowRateBps: 50000 }),
                ...Array(10).fill(new sdk.CurvePoint({ utilizationRateBps: 10000, borrowRateBps: 100000 })),
            ],
        }),
    })
    cfg.assetReserveConfigParams.maxAgePriceSeconds = 3600
    cfg.assetReserveConfigParams.borrowLimitOutsideElevationGroup = new Decimal(1_000_000_000)

    const manager = new sdk.KaminoManager(rpc, undefined, KLEND_PROGRAM.toBase58(), undefined)
    const marketState = await sdk.LendingMarket.fetch(rpc, market.toBase58(), KLEND_PROGRAM.toBase58())
    const configIxs = await manager.updateReserveIxs(kitSigner(admin.publicKey), { address: market.toBase58(), state: marketState }, reserve.toBase58(), cfg.getReserveConfig())
    const sendable = configIxs.filter((c: any) => !c.requiresGlobalAdmin).map((c: any) => withIxSysvar(c.ix))
    for (let i = 0; i < sendable.length; i += 4) await sendIxs(conn, sendable.slice(i, i + 4), admin, [], `cfg-${symbol}-${i}`)

    const types = require('@kamino-finance/klend-sdk/dist/@codegen/klend/types')
    const limitBuf = Buffer.alloc(8)
    limitBuf.writeBigUInt64LE(1_000_000_000n * 10n ** 6n)
    const outsideLimitIx = withIxSysvar(
        await sdk.updateReserveConfigIx(kitSigner(admin.publicKey), market.toBase58(), reserve.toBase58(), new types.UpdateConfigMode.UpdateBorrowLimitOutsideElevationGroup(), limitBuf, KLEND_PROGRAM.toBase58()),
    )
    await sendIxs(conn, [outsideLimitIx], admin, [], `cfg-${symbol}-outside`)

    return { reserve: reserve.toBase58(), reserveLiquiditySupply: pdas.liquiditySupplyVault.toString(), reserveCollateralMint: pdas.collateralMint.toString() }
}

async function main() {
    const numbered = parseNumberedArgs(process.argv.slice(2))
    const conn = connection()
    const admin = adminKeypair()
    const rpc = createSolanaRpc(RPC_URL)
    let state = readState()
    printAssetRegistry(state)

    // Only the keys named on the CLI are touched. No args = ensure whatever state holds.
    let keys: string[]
    if (numbered.length) {
        const mapped = numbered.filter((n) => assetStatus(state.assets[n]) === 'mapped')
        for (const n of mapped) {
            console.error(`refusing ${n}: ${state.assets[n].symbol} already mapped to reserve ${state.assets[n].reserve}`)
        }
        keys = numbered.filter((n) => !mapped.includes(n))
        if (!keys.length) {
            console.error('nothing to do — pick unused numbers, or delete the entry from devnet-state.json to remap')
            process.exit(1)
        }
        state = ensureNumberedAssets(state, keys)
        console.log('working on:', keys.map((n) => `${n}=${numberedSymbol(n)}`).join(', '))
    } else {
        keys = Object.keys(state.assets)
        console.log('no keys given — ensuring existing state assets')
    }
    console.log('admin:', admin.publicKey.toBase58())

    const newReserves: { symbol: string; mint: string; reserve: string }[] = []

    // 1. mints
    for (const key of keys) {
        const a = state.assets[key]
        if (a.mint) {
            console.log(`${a.symbol} mint exists:`, a.mint)
        } else {
            const mint = await ensureMint(conn, admin, a.symbol, a.decimals)
            a.mint = mint.toBase58()
            writeState(state)
            console.log(`${a.symbol} mint:`, a.mint)
        }
    }

    // 2. shared lending market — never create a second one if already recorded
    if (state.lendingMarket) {
        console.log('market exists:', state.lendingMarket)
    } else {
        const marketKp = Keypair.generate()
        const market = marketKp.publicKey
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
            [SystemProgram.createAccount({ fromPubkey: admin.publicKey, newAccountPubkey: market, space: size, lamports: rent, programId: KLEND_PROGRAM }), initIx],
            admin,
            [marketKp],
            'init-market',
        )
        state.lendingMarket = market.toBase58()
        writeState(state)
        console.log('lending market:', state.lendingMarket)
    }
    const market = new PublicKey(state.lendingMarket!)

    // 3. reserves per asset (same market)
    for (const key of keys) {
        const a = state.assets[key]
        if (a.reserve) {
            console.log(`${a.symbol} reserve exists:`, a.reserve)
            continue
        }
        const res = await ensureReserve(conn, rpc, admin, market, new PublicKey(a.mint!), a.symbol, a.decimals)
        Object.assign(a, res)
        writeState(state)
        console.log(`${a.symbol} reserve:`, a.reserve)
        newReserves.push({ symbol: a.symbol, mint: a.mint!, reserve: a.reserve! })
    }

    if (newReserves.length) {
        console.log('\n--- copy into backend/.env and restart ---')
        for (const r of newReserves) {
            console.log(`${r.symbol} mint: ${r.mint}`)
            console.log(`KLEND_PYTH_PRICES_${r.reserve}=${PYTH_USDC_FEED.toBase58()}`)
        }
        console.log('--- then Register the mint on admin Reserves (do not run 20 for numbered keys) ---\n')
    }

    console.log('done. state:', JSON.stringify(readState(), null, 2))
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
