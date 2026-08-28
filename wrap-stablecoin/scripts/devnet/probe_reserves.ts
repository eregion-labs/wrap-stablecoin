/**
 * Decode all devnet KLend reserves: mint, oracle config, limits, status.
 * Shows which oracle setups other devnet users got working.
 * Usage: npx ts-node scripts/devnet/probe_reserves.ts
 */
import { Connection, PublicKey } from '@solana/web3.js'
import { Reserve } from '@kamino-finance/klend-sdk'

const KLEND = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD')
const RPC = process.env.RPC_URL ?? 'https://api.devnet.solana.com'
const RESERVE_SIZE = 8624
const DEFAULT = '11111111111111111111111111111111'

async function main() {
    const conn = new Connection(RPC, 'confirmed')
    const reserves = await conn.getProgramAccounts(KLEND, { filters: [{ dataSize: RESERVE_SIZE }] })
    console.log(`reserves: ${reserves.length}`)
    for (const r of reserves) {
        try {
            const res = Reserve.decode(Buffer.from(r.account.data))
            const cfg: any = res.config
            const ti: any = cfg.tokenInfo
            const scope = ti.scopeConfiguration
            const pyth = ti.pythConfiguration
            const sb = ti.switchboardConfiguration
            const oracle: string[] = []
            if (pyth?.price?.toString() !== DEFAULT) oracle.push(`pyth=${pyth.price}`)
            if (scope?.priceFeed?.toString() !== DEFAULT) oracle.push(`scope=${scope.priceFeed} chain=${scope.priceChain}`)
            if (sb?.priceAggregator?.toString() !== DEFAULT) oracle.push(`switchboard=${sb.priceAggregator}`)
            console.log(
                [
                    r.pubkey.toBase58(),
                    `mint=${res.liquidity.mintPubkey}`,
                    `status=${cfg.status}`,
                    `depositLimit=${cfg.depositLimit}`,
                    `borrowLimit=${cfg.borrowLimit}`,
                    `maxAgePrice=${ti.maxAgePriceSeconds}`,
                    `avail=${res.liquidity.availableAmount}`,
                    `borrowed=${res.liquidity.borrowedAmountSf?.toString?.().slice(0, 8)}`,
                    oracle.length ? oracle.join(' ') : 'NO-ORACLE',
                ].join(' '),
            )
        } catch (e: any) {
            console.log(r.pubkey.toBase58(), 'decode failed:', e.message?.slice(0, 60))
        }
    }
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
