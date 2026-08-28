/**
 * Step 4: full dev-branch multi-asset flow on devnet, admin acts as user too.
 *   wrap A + B -> deposit_to_klend A + B -> wait for yield -> harvest_yield A (positive)
 *   -> sweep_home_surplus A -> withdraw_treasury A -> per-pool liability negative test
 *   -> withdraw_all_from_klend A + B -> unwrap A + B.
 * Usage: npx ts-node scripts/devnet-e2e/40_flow_test.ts
 */
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js'
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, lmaPda, readState, refreshReserveIx } from './common'

const IDL = require('../../target/idl/wrap_stablecoin.json')
const BN = anchor.BN

const WRAP = new BN(100_000_000_000) // 100k
const DEPOSIT = new BN(80_000_000_000) // 80k to KLend
const YIELD_MIN = 100_000n
const POLL_S = 20
const MAX_POLL = 30
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))

async function main() {
    const st = readState()
    const conn = connection()
    const admin = adminKeypair()
    const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(admin), { commitment: 'confirmed' })
    anchor.setProvider(provider)
    const program = new anchor.Program(IDL as anchor.Idl, provider)
    const coder = new anchor.BorshAccountsCoder(IDL as anchor.Idl)
    const trackedInKlend = async (klendConfig: PublicKey): Promise<bigint> => {
        const info = await conn.getAccountInfo(klendConfig)
        return BigInt(coder.decode('KLendConfig', info!.data).total_liquidity_in_klend.toString())
    }

    const market = new PublicKey(st.lendingMarket!)
    const vaultConfig = new PublicKey(st.vaultConfig!)
    const vaultAuthority = new PublicKey(st.vaultAuthority!)
    const wrappedMint = new PublicKey(st.wrappedMint!)
    const lma = lmaPda(market)
    const userWrapped = getAssociatedTokenAddressSync(wrappedMint, admin.publicKey)

    const A = st.assets.A
    const B = st.assets.B
    const acc = (a: typeof A) => ({
        mint: new PublicKey(a.mint!),
        reserve: new PublicKey(a.reserve!),
        reserveLiquiditySupply: new PublicKey(a.reserveLiquiditySupply!),
        reserveCollateralMint: new PublicKey(a.reserveCollateralMint!),
        assetConfig: new PublicKey(a.assetConfig!),
        tokenVault: new PublicKey(a.tokenVault!),
        treasuryVault: new PublicKey(a.treasuryVault!),
        collateralVault: new PublicKey(a.collateralVault!),
        klendConfig: new PublicKey(a.klendConfig!),
        userAta: getAssociatedTokenAddressSync(new PublicKey(a.mint!), admin.publicKey),
    })
    const pa = acc(A)
    const pb = acc(B)

    const bal = async (addr: PublicKey, name: string) => {
        try {
            const v = (await getAccount(conn, addr)).amount
            console.log(`  ${name}: ${v}`)
            return v
        } catch {
            console.log(`  ${name}: (none)`)
            return 0n
        }
    }

    // net liability (wStable) of one pool, from AssetConfig
    const poolLiability = async (assetConfig: PublicKey): Promise<bigint> => {
        const info = await conn.getAccountInfo(assetConfig)
        const d: any = coder.decode('AssetConfig', info!.data)
        const minted = BigInt(d.total_wrapped_minted.toString())
        const redeemed = BigInt(d.total_redemptions.toString())
        return minted > redeemed ? minted - redeemed : 0n
    }

    // ---- wrap A and B (idempotent: only wrap up to WRAP of liability per pool) ----
    const wrappedAtaIx = createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, userWrapped, admin.publicKey, wrappedMint)
    for (const [sym, p] of [['A', pa], ['B', pb]] as const) {
        const already = await poolLiability(p.assetConfig)
        if (already >= BigInt(WRAP.toString())) {
            console.log(`=== wrap ${sym} — already ${already}, skip`)
            continue
        }
        const need = new BN((BigInt(WRAP.toString()) - already).toString())
        console.log(`=== wrap ${sym} (${need.toString()})`)
        const sig = await program.methods
            .wrap({ amount: need } as any)
            .accountsPartial({
                user: admin.publicKey, vaultConfig, vaultAuthority, assetConfig: p.assetConfig, tokenMint: p.mint,
                userToken: p.userAta, userWrapped, wrappedMint, tokenVault: p.tokenVault, allowlist: null,
                collateralTokenProgram: TOKEN_PROGRAM_ID, florinTokenProgram: TOKEN_PROGRAM_ID,
            } as any)
            .preInstructions([wrappedAtaIx])
            .rpc()
        console.log(`  wrap ${sym} tx`, sig)
    }
    await bal(userWrapped, 'user Florin')

    // ---- deposit to KLend for both (idempotent: top up to DEPOSIT tracked) ----
    for (const [sym, p] of [['A', pa], ['B', pb]] as const) {
        const tracked = await trackedInKlend(p.klendConfig)
        if (tracked >= BigInt(DEPOSIT.toString())) {
            console.log(`=== deposit_to_klend ${sym} — already ${tracked}, skip`)
            continue
        }
        console.log(`=== deposit_to_klend ${sym}`)
        const sig = await program.methods
            .depositToKlend({ amount: DEPOSIT } as any)
            .accountsPartial({
                admin: admin.publicKey, vaultConfig, vaultAuthority, assetConfig: p.assetConfig, klendConfig: p.klendConfig,
                tokenVault: p.tokenVault, tokenMint: p.mint, klendProgram: KLEND_PROGRAM, lendingMarket: market, lendingMarketAuthority: lma,
                reserve: p.reserve, reserveLiquiditySupply: p.reserveLiquiditySupply, reserveCollateralMint: p.reserveCollateralMint, collateralVault: p.collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID, collateralTokenProgram: TOKEN_PROGRAM_ID, instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            } as any)
            .preInstructions([refreshReserveIx(p.reserve, market)])
            .rpc()
        console.log(`  deposit ${sym} tx`, sig)
    }

    // ---- wait for yield on A ----
    console.log('=== waiting for interest accrual on A')
    const SF = 2n ** 60n
    const refreshedReserve = async (reserve: PublicKey) => {
        const sdk = require('@kamino-finance/klend-sdk')
        const tx = new anchor.web3.Transaction().add(refreshReserveIx(reserve, market))
        tx.feePayer = admin.publicKey
        tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
        tx.sign(admin)
        const sim = await conn.simulateTransaction(tx, undefined, [reserve])
        return sdk.Reserve.decode(Buffer.from(sim.value.accounts![0]!.data[0], 'base64'))
    }
    let harvestable = 0n
    let rate = 1
    for (let i = 0; i < MAX_POLL; i++) {
        const res = await refreshedReserve(pa.reserve)
        const totalLiq = BigInt(res.liquidity.availableAmount.toString()) + BigInt(res.liquidity.borrowedAmountSf.toString()) / SF - BigInt(res.liquidity.accumulatedProtocolFeesSf.toString()) / SF
        const collSupply = BigInt(res.collateral.mintTotalSupply.toString())
        rate = Number(totalLiq) / Number(collSupply)
        const kTokens = (await getAccount(conn, pa.collateralVault)).amount
        const tracked = await trackedInKlend(pa.klendConfig)
        const value = BigInt(Math.floor(Number(kTokens) * rate))
        harvestable = value > tracked ? value - tracked : 0n
        console.log(`  poll ${i}: value=${value} tracked=${tracked} yield=${harvestable}`)
        if (harvestable >= YIELD_MIN) break
        await sleep(POLL_S)
    }
    if (harvestable < YIELD_MIN) throw new Error('no yield accrued; borrower set up?')

    // ---- harvest_yield A (positive) ----
    const redeem = BigInt(Math.floor((Number(harvestable) * 0.9) / rate))
    console.log(`=== harvest_yield A, redeem ${redeem} kTokens`)
    let sig = await program.methods
        .harvestYield({ collateralAmount: new BN(redeem.toString()) } as any)
        .accountsPartial({
            admin: admin.publicKey, vaultConfig, vaultAuthority, assetConfig: pa.assetConfig, klendConfig: pa.klendConfig, tokenMint: pa.mint,
            treasuryVault: pa.treasuryVault, collateralVault: pa.collateralVault, klendProgram: KLEND_PROGRAM, lendingMarket: market, lendingMarketAuthority: lma,
            reserve: pa.reserve, reserveLiquiditySupply: pa.reserveLiquiditySupply, reserveCollateralMint: pa.reserveCollateralMint,
            tokenProgram: TOKEN_PROGRAM_ID, collateralTokenProgram: TOKEN_PROGRAM_ID, instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .preInstructions([refreshReserveIx(pa.reserve, market)])
        .rpc()
    console.log('  harvest tx', sig)
    const treasuryAfterHarvest = await bal(pa.treasuryVault, 'A treasury (harvested)')
    if (treasuryAfterHarvest === 0n) throw new Error('harvest gave empty treasury')

    // ---- per-pool liability negative test: unwrap more B than B liability should fail ----
    console.log('=== negative: unwrap B beyond pool liability must fail')
    let failed = false
    try {
        await program.methods
            .unwrap({ amount: new BN(200_000_000_000) } as any) // 200k > 100k B liability
            .accountsPartial({
                user: admin.publicKey, vaultConfig, vaultAuthority, userWrapped, userAssetToken: pb.userAta, wrappedMint,
                assetConfig: pb.assetConfig, tokenMint: pb.mint, tokenVault: pb.tokenVault, allowlist: null,
                collateralTokenProgram: TOKEN_PROGRAM_ID, florinTokenProgram: TOKEN_PROGRAM_ID,
            } as any)
            .rpc()
    } catch (e: any) {
        failed = true
        console.log('  rejected as expected:', e?.error?.errorCode?.code ?? String(e).slice(0, 60))
    }
    if (!failed) throw new Error('over-liability unwrap should have failed')

    // ---- withdraw_all_from_klend A and B (refill token_vault) ----
    for (const [sym, p] of [['A', pa], ['B', pb]] as const) {
        console.log(`=== withdraw_all_from_klend ${sym}`)
        sig = await program.methods
            .withdrawAllFromKlend()
            .accountsPartial({
                admin: admin.publicKey, vaultConfig, vaultAuthority, assetConfig: p.assetConfig, klendConfig: p.klendConfig,
                tokenVault: p.tokenVault, tokenMint: p.mint, klendProgram: KLEND_PROGRAM, lendingMarket: market, lendingMarketAuthority: lma,
                reserve: p.reserve, reserveLiquiditySupply: p.reserveLiquiditySupply, reserveCollateralMint: p.reserveCollateralMint, collateralVault: p.collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID, collateralTokenProgram: TOKEN_PROGRAM_ID, instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            } as any)
            .preInstructions([refreshReserveIx(p.reserve, market)])
            .rpc()
        console.log(`  withdraw_all ${sym} tx`, sig)
    }

    // ---- sweep_home_surplus A: now token_vault holds the full principal back, mint a
    // small surplus on top of liability so home_surplus_amount > 0, then sweep it ----
    console.log('=== sweep_home_surplus A')
    const SURPLUS = 5_000_000n // 5 tUSDA above liability
    await program.provider.sendAndConfirm!(
        new anchor.web3.Transaction().add(createMintToInstruction(pa.mint, pa.tokenVault, admin.publicKey, SURPLUS)),
        [],
    )
    sig = await program.methods
        .sweepHomeSurplus({ amount: new BN(SURPLUS.toString()) } as any)
        .accountsPartial({
            admin: admin.publicKey, vaultConfig, vaultAuthority, assetConfig: pa.assetConfig, tokenMint: pa.mint,
            tokenVault: pa.tokenVault, treasuryVault: pa.treasuryVault, tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc()
    console.log('  sweep tx', sig)
    await bal(pa.treasuryVault, 'A treasury (harvest + sweep)')

    // ---- withdraw_treasury A to admin's ATA (harvest yield + swept surplus) ----
    console.log('=== withdraw_treasury A')
    const treasuryBal = (await getAccount(conn, pa.treasuryVault)).amount
    sig = await program.methods
        .withdrawTreasury({ amount: new BN(treasuryBal.toString()) } as any)
        .accountsPartial({
            admin: admin.publicKey, vaultConfig, vaultAuthority, assetConfig: pa.assetConfig, tokenMint: pa.mint,
            treasuryVault: pa.treasuryVault, destination: pa.userAta, tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc()
    console.log('  withdraw_treasury tx', sig, '-> pulled', treasuryBal.toString())

    // ---- unwrap A and B (each against its own pool; bounded by free liquidity) ----
    for (const [sym, p] of [['A', pa], ['B', pb]] as const) {
        const liability = await poolLiability(p.assetConfig)
        const free = (await getAccount(conn, p.tokenVault)).amount
        const amount = liability < free ? liability : free
        console.log(`=== unwrap ${sym} (${amount}, liability ${liability}, free ${free})`)
        sig = await program.methods
            .unwrap({ amount: new BN(amount.toString()) } as any)
            .accountsPartial({
                user: admin.publicKey, vaultConfig, vaultAuthority, userWrapped, userAssetToken: p.userAta, wrappedMint,
                assetConfig: p.assetConfig, tokenMint: p.mint, tokenVault: p.tokenVault, allowlist: null,
                collateralTokenProgram: TOKEN_PROGRAM_ID, florinTokenProgram: TOKEN_PROGRAM_ID,
            } as any)
            .rpc()
        console.log(`  unwrap ${sym} tx`, sig)
    }

    console.log('=== final balances')
    await bal(userWrapped, 'user Florin (residual)')
    await bal(pa.userAta, 'user tUSDA')
    await bal(pb.userAta, 'user tUSDB')
    console.log('FULL MULTI-ASSET FLOW PASSED — yield, harvest, sweep, treasury withdraw, per-pool guard, unwrap')
}

main().catch((e) => {
    console.error(e)
    if (e.logs) console.error(e.logs.slice(-15).join('\n'))
    process.exit(1)
})
