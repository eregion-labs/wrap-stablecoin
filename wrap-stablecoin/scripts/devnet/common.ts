/**
 * Shared helpers for devnet bootstrap scripts.
 * Bridges @kamino-finance/klend-sdk (kit-style instructions) to web3.js v1 send flow.
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
export const WRAP_PROGRAM = new PublicKey('HCrgCD3HkPXFF4CufxbvCVyfMhYJS8ZeLc6r5cLB9dNY')
/** Pyth receiver (rec5...) USDC/USD price update account on devnet; live, used by active devnet reserves. */
export const PYTH_USDC_FEED = new PublicKey('Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX')

const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..')
export const SECRETS_DIR = process.env.SECRETS_DIR ?? path.join(MONOREPO_ROOT, '.secrets')
export const STATE_FILE = path.join(__dirname, 'devnet-state.json')

export function loadKeypair(file: string): Keypair {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Keypair.fromSecretKey(Uint8Array.from(raw))
}

/** Admin keypair: seeds vault_config, owns the KLend market, mint authority of test USDC. */
export function adminKeypair(): Keypair {
    return loadKeypair(path.join(SECRETS_DIR, 'admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json'))
}

export interface DevnetState {
    usdcMint?: string
    lendingMarket?: string
    reserve?: string
    reserveLiquiditySupply?: string
    reserveCollateralMint?: string
    borrower?: string
    obligation?: string
    vaultConfig?: string
    vaultAuthority?: string
    wrappedMint?: string
    tokenConfig?: string
    tokenVault?: string
    collateralVault?: string
    treasury?: string
}

export function readState(): DevnetState {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    } catch {
        return {}
    }
}

export function writeState(patch: DevnetState): DevnetState {
    const merged = { ...readState(), ...patch }
    fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2) + '\n')
    return merged
}

export function connection(): Connection {
    return new Connection(RPC_URL, 'confirmed')
}

/** Minimal TransactionSigner stand-in for kit-style builders; signing happens via web3.js v1. */
export function kitSigner(pubkey: PublicKey): any {
    return { address: pubkey.toBase58() }
}

/** Convert a kit-style IInstruction (klend-sdk output) to a web3.js v1 TransactionInstruction. */
export function toV1Ix(ix: any): TransactionInstruction {
    // kit AccountRole: 0 readonly, 1 writable, 2 readonly-signer, 3 writable-signer
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
        const sig = await sendAndConfirmTransaction(conn, tx, [payer, ...extraSigners], {
            commitment: 'confirmed',
        })
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
