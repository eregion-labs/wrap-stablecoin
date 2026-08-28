// Devnet vault observability: fetches every on-chain figure the admin dashboard shows.
// Addresses come from wrap-stablecoin/scripts/devnet/devnet-state.json (bootstrap output).
import {
    Connection,
    PublicKey,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js'
import { BorshAccountsCoder, Idl } from '@coral-xyz/anchor'
import idl from './kamino_tester_idl.json'

export const ADDR = {
    usdcMint: new PublicKey('GFRRf9xyH735NL528Z5PfWx8vTm1tfyxppMGFT2aJDUj'),
    lendingMarket: new PublicKey('9zRZ631GszxBAqMiHy3rNuKXp85QxhFcQNKCTVhpG1PT'),
    reserve: new PublicKey('i6gVa1B4dLSj3MiE1yxEEbQkC93aRg4MKmFvMKEUfDB'),
    vaultConfig: new PublicKey('7o2EpdwH2Erfa3msghJtBSAPTNes7hopgxUxCVJ6TDKE'),
    wrappedMint: new PublicKey('9Ru5ZX8A1LrgkK2fFQ2n7SnZd9A5e4DAmbUw86fAgFhP'),
    tokenConfig: new PublicKey('GW7hnqeVQWpu5h2mLguZ8rgCFAgHbHpTxRgWzeNxdwaG'),
    tokenVault: new PublicKey('Dp6QzNTjvZX579jy4m9xyLzSW7SoQEGLtohtBEg1uATZ'),
    collateralVault: new PublicKey('J71ZCLS8eTHWz4zjDVBxKbtP1pbKJbd2isX9VvfYnvuz'),
    treasury: new PublicKey('AQVnvjiEQe945eAm2Qo76Hy4juifCJWzWNPWgnnzTYn7'),
    admin: new PublicKey('admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x'),
    klend: new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD'),
    pythFeed: new PublicKey('Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX'),
}

// Reserve struct byte offsets for the deployed devnet KLend build (computed from
// @kamino-finance/klend-sdk Reserve.layout; account size 8624).
const OFF = {
    availableAmount: 224, // u64
    borrowedAmountSf: 232, // u128, scaled by 2^60
    accumulatedProtocolFeesSf: 344, // u128, scaled by 2^60
    mintTotalSupply: 2592, // u64
}
const SF = 2n ** 60n
const REFRESH_RESERVE_SIGHASH = Buffer.from([2, 218, 138, 235, 79, 201, 25, 102])

// Borrow curve configured by 10_setup_market.ts: 500% APR at 0% utilization -> 1000% at 100%.
const CURVE_BASE_BPS = 50000
const CURVE_MAX_BPS = 100000

export interface VaultSnapshot {
    slot: number
    wrappedSupply: bigint
    freeLiquidity: bigint
    trackedInKlend: bigint
    liveKlendValue: bigint
    unharvestedYield: bigint
    treasuryBalance: bigint
    collateralKTokens: bigint
    utilizationPct: number
    borrowAprPct: number
    supplyApyPct: number
    exchangeRate: number
    paused: boolean
    wrapPublic: boolean
    unwrapPublic: boolean
    totalStableDeposited: bigint
}

function refreshReserveIx(): TransactionInstruction {
    const sentinel = ADDR.klend
    return new TransactionInstruction({
        programId: ADDR.klend,
        keys: [
            { pubkey: ADDR.reserve, isSigner: false, isWritable: true },
            { pubkey: ADDR.lendingMarket, isSigner: false, isWritable: false },
            { pubkey: ADDR.pythFeed, isSigner: false, isWritable: false },
            { pubkey: sentinel, isSigner: false, isWritable: false },
            { pubkey: sentinel, isSigner: false, isWritable: false },
            { pubkey: sentinel, isSigner: false, isWritable: false },
        ],
        data: REFRESH_RESERVE_SIGHASH,
    })
}

/** Reserve state with interest accrued to *now*: KLend accrual is lazy, so we simulate
 *  a refresh_reserve and read the post-execution account instead of the stale snapshot. */
async function refreshedReserveData(conn: Connection): Promise<Buffer> {
    const { blockhash } = await conn.getLatestBlockhash()
    const msg = new TransactionMessage({
        payerKey: ADDR.admin,
        recentBlockhash: blockhash,
        instructions: [refreshReserveIx()],
    }).compileToV0Message()
    const tx = new VersionedTransaction(msg)
    const sim = await conn.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        accounts: { encoding: 'base64', addresses: [ADDR.reserve.toBase58()] },
    })
    const acc = sim.value.accounts?.[0]
    if (!acc) throw new Error(`refresh simulation failed: ${JSON.stringify(sim.value.err)}`)
    return Buffer.from(acc.data[0], 'base64')
}

// DataView instead of Buffer methods: the browser Buffer polyfill lacks readBigUInt64LE
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)
const readU64 = (b: Uint8Array, o: number) => dv(b).getBigUint64(o, true)
const readU128 = (b: Uint8Array, o: number) => dv(b).getBigUint64(o, true) + (dv(b).getBigUint64(o + 8, true) << 64n)

export async function fetchVaultSnapshot(conn: Connection): Promise<VaultSnapshot> {
    const coder = new BorshAccountsCoder(idl as Idl)
    const [slot, reserveData, vaultInfo, tokenCfgInfo, wrappedSupplyRes, vaultBal, collBal, treasuryBal] =
        await Promise.all([
            conn.getSlot(),
            refreshedReserveData(conn),
            conn.getAccountInfo(ADDR.vaultConfig),
            conn.getAccountInfo(ADDR.tokenConfig),
            conn.getTokenSupply(ADDR.wrappedMint),
            conn.getTokenAccountBalance(ADDR.tokenVault),
            conn.getTokenAccountBalance(ADDR.collateralVault),
            conn.getTokenAccountBalance(ADDR.treasury),
        ])
    if (!vaultInfo || !tokenCfgInfo) throw new Error('vault accounts missing on devnet')

    const vault: any = coder.decode('VaultConfig', vaultInfo.data)
    const tokenCfg: any = coder.decode('TokenConfig', tokenCfgInfo.data)

    const available = readU64(reserveData, OFF.availableAmount)
    const borrowed = readU128(reserveData, OFF.borrowedAmountSf) / SF
    const protocolFees = readU128(reserveData, OFF.accumulatedProtocolFeesSf) / SF
    const collSupply = readU64(reserveData, OFF.mintTotalSupply)
    const totalLiquidity = available + borrowed - protocolFees
    const exchangeRate = collSupply > 0n ? Number(totalLiquidity) / Number(collSupply) : 1

    const kTokens = BigInt(collBal.value.amount)
    const liveValue = BigInt(Math.floor(Number(kTokens) * exchangeRate))
    const tracked = BigInt(tokenCfg.total_liquidity_in_klend.toString())
    const utilization = totalLiquidity > 0n ? Number(borrowed) / Number(totalLiquidity) : 0
    const borrowAprBps = CURVE_BASE_BPS + (CURVE_MAX_BPS - CURVE_BASE_BPS) * utilization

    return {
        slot,
        wrappedSupply: BigInt(wrappedSupplyRes.value.amount),
        freeLiquidity: BigInt(vaultBal.value.amount),
        trackedInKlend: tracked,
        liveKlendValue: liveValue,
        unharvestedYield: liveValue > tracked ? liveValue - tracked : 0n,
        treasuryBalance: BigInt(treasuryBal.value.amount),
        collateralKTokens: kTokens,
        utilizationPct: utilization * 100,
        borrowAprPct: borrowAprBps / 100,
        supplyApyPct: (borrowAprBps / 100) * utilization,
        exchangeRate,
        paused: vault.paused,
        wrapPublic: vault.wrap_public,
        unwrapPublic: vault.unwrap_public,
        totalStableDeposited: BigInt(vault.total_stable_deposited.toString()),
    }
}

export function fmt(base: bigint, decimals = 6): string {
    const neg = base < 0n
    const v = neg ? -base : base
    const whole = v / 10n ** BigInt(decimals)
    const frac = (v % 10n ** BigInt(decimals)).toString().padStart(decimals, '0')
    return `${neg ? '-' : ''}${whole.toLocaleString()}.${frac}`
}
