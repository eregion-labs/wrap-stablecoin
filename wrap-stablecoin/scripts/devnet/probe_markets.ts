/**
 * Probe devnet KLend for existing lending markets and reserves.
 * Usage: npx ts-node scripts/devnet/probe_markets.ts
 */
import { Connection, PublicKey } from '@solana/web3.js'

const KLEND = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD')
const RPC = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const MARKET_SIZE = 4664
const RESERVE_SIZE = 8624

async function main() {
    const conn = new Connection(RPC, 'confirmed')

    const markets = await conn.getProgramAccounts(KLEND, {
        filters: [{ dataSize: MARKET_SIZE }],
        dataSlice: { offset: 0, length: 0 },
    })
    console.log(`lending markets on devnet: ${markets.length}`)
    for (const m of markets) console.log('  market', m.pubkey.toBase58())

    const reserves = await conn.getProgramAccounts(KLEND, {
        filters: [{ dataSize: RESERVE_SIZE }],
    })
    console.log(`reserves on devnet: ${reserves.length}`)
    for (const r of reserves) {
        const d = r.account.data
        // Reserve layout: 8 discriminator + version(u64) + lastUpdate(16) + lendingMarket(32) ...
        const market = new PublicKey(d.subarray(32, 64))
        // liquidity mint sits in ReserveLiquidity; scan is fragile, print raw offsets instead
        console.log('  reserve', r.pubkey.toBase58(), 'market', market.toBase58())
    }
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
