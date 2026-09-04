/**
 * Optional orchestrator: 10_setup_market for the given numbers, then 30_borrower
 * for each that still has no obligation.
 * Usage: npx ts-node scripts/devnet-e2e/run_pipeline.ts 1 2 3
 */
import { spawnSync } from 'child_process'
import * as path from 'path'
import { assetStatus, parseNumberedArgs, printAssetRegistry, readState } from './common'

function run(script: string, args: string[] = []) {
    const file = path.join(__dirname, script)
    const r = spawnSync('npx', ['ts-node', file, ...args], { stdio: 'inherit', cwd: path.join(__dirname, '..', '..') })
    if (r.status !== 0) process.exit(r.status ?? 1)
}

async function main() {
    const numbered = parseNumberedArgs(process.argv.slice(2))
    if (!numbered.length) {
        console.error('usage: npx ts-node scripts/devnet-e2e/run_pipeline.ts 1 2 3')
        process.exit(1)
    }
    const before = readState()
    printAssetRegistry(before)
    const taken = numbered.filter((n) => assetStatus(before.assets[n]) === 'mapped')
    for (const n of taken) {
        console.error(`refusing ${n}: ${before.assets[n].symbol} already mapped to reserve ${before.assets[n].reserve}`)
    }
    const keys = numbered.filter((n) => !taken.includes(n))
    if (!keys.length) {
        console.error('nothing to do — pick unused numbers, or delete the entry from devnet-state.json to remap')
        process.exit(1)
    }

    run('10_setup_market.ts', keys)

    const state = readState()
    for (const n of keys) {
        const a = state.assets[n]
        if (!a?.reserve) {
            console.error(`asset ${n} still has no reserve after 10; abort`)
            process.exit(1)
        }
        if (a.obligation) {
            console.log(`[${a.symbol}] obligation exists — skip borrower`)
            continue
        }
        run('30_borrower.ts', [n])
    }
    console.log('pipeline done')
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
