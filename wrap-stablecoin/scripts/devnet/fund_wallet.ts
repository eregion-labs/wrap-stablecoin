/**
 * Fund any wallet with devnet SOL (from admin) and freshly minted tUSDC.
 * Usage: npx ts-node scripts/devnet/fund_wallet.ts <WALLET_PUBKEY> [tUSDC_base_units]
 */
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { adminKeypair, connection, readState, sendIxs } from './common'

async function main() {
    const user = new PublicKey(process.argv[2])
    const amount = BigInt(process.argv[3] ?? 1_000_000_000) // default 1000 tUSDC
    const conn = connection()
    const admin = adminKeypair()
    const mint = new PublicKey(readState().usdcMint!)
    const ata = getAssociatedTokenAddressSync(mint, user)
    const sol = await conn.getBalance(user)
    console.log('user SOL:', sol / 1e9)
    const ixs: TransactionInstruction[] = []
    if (sol < 20_000_000) {
        ixs.push(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user, lamports: 50_000_000 }))
    }
    ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata, user, mint),
        createMintToInstruction(mint, ata, admin.publicKey, amount),
    )
    await sendIxs(conn, ixs, admin, [], 'fund-wallet')
    console.log(`funded ${user.toBase58()} with ${amount} base units tUSDC (ata ${ata.toBase58()})`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
