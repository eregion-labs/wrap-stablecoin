/**
 * Shared helpers for the dev-branch multi-asset devnet e2e.
 * Bridges @kamino-finance/klend-sdk (kit-style) to web3.js v1, tracks a shared
 * KLend market + per-asset reserves + the wrap_stablecoin vault.
 */
import * as fs from 'fs'
import * as path from 'path'
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
} from '@solana/web3.js'

export const RPC_URL = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
export const KLEND_PROGRAM = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD')
/** wrap_stablecoin program deployed on devnet (fresh keypair, declare_id updated to match). */
export const WRAP_PROGRAM = new PublicKey('DUKXaKc4q6DXKf6mB13iyAB5vgBRvMH8WC2qy3RGUqSJ')
/** Live devnet Pyth receiver USDC/USD price update account; both test stables peg ~$1. */
export const PYTH_USDC_FEED = new PublicKey('Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX')

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..')
export const SECRETS_DIR = process.env.SECRETS_DIR ?? path.join(PACKAGE_ROOT, '.secrets')
export const STATE_FILE = path.join(__dirname, 'devnet-state.json')

export function loadKeypair(file: string): Keypair {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))))
}

/** Admin keypair: vault authority/admin, KLend market owner, mint authority of both test tokens. */
export function adminKeypair(): Keypair {
    return loadKeypair(path.join(SECRETS_DIR, 'admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json'))
}

export interface AssetState {
    symbol: string
    mint?: string
    decimals: number
    // KLend reserve
    reserve?: string
    reserveLiquiditySupply?: string
    reserveCollateralMint?: string
    // wrap_stablecoin per-asset PDAs
    assetConfig?: string
    tokenVault?: string
    treasuryVault?: string
    collateralVault?: string
    klendConfig?: string
    // yield borrower
    borrower?: string
    obligation?: string
}

export interface DevnetState {
    lendingMarket?: string
    vaultConfig?: string
    vaultAuthority?: string
    wrappedMint?: string
    assets: Record<string, AssetState>
}

const DEFAULT_STATE: DevnetState = {
    assets: {
        A: { symbol: 'tUSDA', decimals: 6 },
        B: { symbol: 'tUSDB', decimals: 6 },
    },
}

export function readState(): DevnetState {
    try {
        const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
        return { ...DEFAULT_STATE, ...s, assets: { ...DEFAULT_STATE.assets, ...(s.assets ?? {}) } }
    } catch {
        return JSON.parse(JSON.stringify(DEFAULT_STATE))
    }
}

export function writeState(state: DevnetState): DevnetState {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
    return state
}

/** Merge a patch into one asset and persist. */
export function patchAsset(key: string, patch: Partial<AssetState>): DevnetState {
    const s = readState()
    s.assets[key] = { ...s.assets[key], ...patch }
    return writeState(s)
}

export function connection(): Connection {
    return new Connection(RPC_URL, 'confirmed')
}

export function kitSigner(pubkey: PublicKey): any {
    return { address: pubkey.toBase58() }
}

/** kit IInstruction -> web3.js v1 TransactionInstruction. Roles: 0 ro, 1 w, 2 ro-signer, 3 w-signer. */
export function toV1Ix(ix: any): TransactionInstruction {
    const keys = (ix.accounts ?? []).map((a: any) => ({
        pubkey: new PublicKey(a.address),
        isSigner: a.role === 2 || a.role === 3,
        isWritable: a.role === 1 || a.role === 3,
    }))
    return new TransactionInstruction({
        programId: new PublicKey(ix.programAddress),
        keys,
        data: Buffer.from(ix.data ?? []),
    })
}

export async function sendIxs(
    conn: Connection,
    ixs: (TransactionInstruction | any)[],
    payer: Keypair,
    extraSigners: Keypair[] = [],
    label = 'tx',
): Promise<string> {
    const tx = new Transaction()
    for (const ix of ixs) tx.add(ix instanceof TransactionInstruction ? ix : toV1Ix(ix))
    try {
        const sig = await sendAndConfirmTransaction(conn, tx, [payer, ...extraSigners], { commitment: 'confirmed' })
        console.log(`[${label}] ok ${sig}`)
        return sig
    } catch (e: any) {
        console.error(`[${label}] failed:`, e.message)
        if (e.logs) console.error(e.logs.slice(-12).join('\n'))
        throw e
    }
}

export function sighash(name: string): Buffer {
    const { createHash } = require('crypto')
    return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

/** KLend refresh_reserve ix; unused oracle slots point at the KLend program id as sentinel. */
export function refreshReserveIx(reserve: PublicKey, market: PublicKey): TransactionInstruction {
    const s = KLEND_PROGRAM
    return new TransactionInstruction({
        programId: KLEND_PROGRAM,
        keys: [
            { pubkey: reserve, isSigner: false, isWritable: true },
            { pubkey: market, isSigner: false, isWritable: false },
            { pubkey: PYTH_USDC_FEED, isSigner: false, isWritable: false },
            { pubkey: s, isSigner: false, isWritable: false },
            { pubkey: s, isSigner: false, isWritable: false },
            { pubkey: s, isSigner: false, isWritable: false },
        ],
        data: sighash('refresh_reserve'),
    })
}

export function lmaPda(market: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('lma'), market.toBuffer()], KLEND_PROGRAM)[0]
}

/** Vault-seeded e2e assets only — numbered dummies are registered via the admin Reserves UI. */
export const VAULT_ASSET_KEYS = ['A', 'B'] as const

/** Numbered dummy key `N` → symbol `tUSDN` (e.g. 1 → tUSD1). */
export function numberedSymbol(n: string | number): string {
    return `tUSD${n}`
}

/** Parse CLI args as positive integers (e.g. `1 2 3`). Rejects letters and zero. */
export function parseNumberedArgs(argv: string[]): string[] {
    const out: string[] = []
    for (const raw of argv) {
        if (!/^[1-9]\d*$/.test(raw)) {
            throw new Error(`expected positive integer asset key, got ${JSON.stringify(raw)}`)
        }
        if (!out.includes(raw)) out.push(raw)
    }
    return out
}

/** Ensure state.assets[N] exists for each numbered key (does not overwrite mint/reserve). */
export function ensureNumberedAssets(state: DevnetState, numbers: string[]): DevnetState {
    for (const n of numbers) {
        if (!state.assets[n]) {
            state.assets[n] = { symbol: numberedSymbol(n), decimals: 6 }
        } else if (!state.assets[n].symbol) {
            state.assets[n].symbol = numberedSymbol(n)
        }
    }
    return writeState(state)
}

/**
 * `unmapped` = nothing on chain yet, `partial` = mint but no KLend reserve
 * (resumable after a failed run), `mapped` = mint + reserve already recorded.
 */
export type AssetStatus = 'unmapped' | 'partial' | 'mapped'

export function assetStatus(a?: AssetState): AssetStatus {
    if (!a?.mint) return 'unmapped'
    return a.reserve ? 'mapped' : 'partial'
}

/** devnet-state.json is the registry of which key owns which mint/reserve. */
export function printAssetRegistry(state: DevnetState): void {
    const keys = Object.keys(state.assets)
    console.log('registry (devnet-state.json)')
    if (!keys.length) {
        console.log('(empty)')
        return
    }
    const head = ['KEY', 'SYMBOL', 'STATUS', 'MINT', 'RESERVE']
    const rows = keys.map((key) => {
        const a = state.assets[key]
        return [key, a.symbol ?? '-', assetStatus(a), a.mint ?? '-', a.reserve ?? '-']
    })
    // Column widths so addresses stay flush-left and selectable as whole words.
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
    const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()
    console.log(line(head))
    console.log(widths.map((w) => '-'.repeat(w)).join('  '))
    for (const r of rows) console.log(line(r))
}
