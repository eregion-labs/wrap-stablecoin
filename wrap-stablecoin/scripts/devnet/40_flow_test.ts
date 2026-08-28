/**
 * Step 4: full wrap-program flow on devnet with real yield:
 * wrap -> deposit_to_klend -> wait for interest -> harvest_yield (positive path)
 * -> withdraw_from_klend -> unwrap. Prints balances at every step.
 * Usage: npx ts-node scripts/devnet/40_flow_test.ts
 */
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAccount,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { adminKeypair, connection, KLEND_PROGRAM, PYTH_USDC_FEED, readState } from './common'

const sdk = require('@kamino-finance/klend-sdk')
const IDL = require('../../target/idl/kamino_tester.json')

const WRAP_AMOUNT = new anchor.BN(100_000_000_000) // 100k tUSDC
const KLEND_DEPOSIT = new anchor.BN(80_000_000_000) // 80k into KLend
const YIELD_THRESHOLD = 100_000n // harvest once >= 0.1 tUSDC accrued
const POLL_SECONDS = 20
const MAX_POLLS = 45 // up to 15 minutes

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000))

async function main() {
    const st = readState()
    const conn = connection()
    const admin = adminKeypair()
    const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(admin), { commitment: 'confirmed' })
    anchor.setProvider(provider)
    const program = new anchor.Program(IDL as anchor.Idl, provider)

    const usdcMint = new PublicKey(st.usdcMint!)
    const market = new PublicKey(st.lendingMarket!)
    const reserve = new PublicKey(st.reserve!)
    const reserveLiquiditySupply = new PublicKey(st.reserveLiquiditySupply!)
    const reserveCollateralMint = new PublicKey(st.reserveCollateralMint!)
    const vaultConfig = new PublicKey(st.vaultConfig!)
    const vaultAuthority = new PublicKey(st.vaultAuthority!)
    const wrappedMint = new PublicKey(st.wrappedMint!)
    const tokenConfig = new PublicKey(st.tokenConfig!)
    const tokenVault = new PublicKey(st.tokenVault!)
    const collateralVault = new PublicKey(st.collateralVault!)
    const treasury = new PublicKey(st.treasury!)
    const lendingMarketAuthority = PublicKey.findProgramAddressSync([Buffer.from('lma'), market.toBuffer()], KLEND_PROGRAM)[0]

    const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, admin.publicKey)
    const userWrappedAta = getAssociatedTokenAddressSync(wrappedMint, admin.publicKey, true)

    const refreshIx = () =>
        new anchor.web3.TransactionInstruction({
            programId: KLEND_PROGRAM,
            keys: [
                { pubkey: reserve, isSigner: false, isWritable: true },
                { pubkey: market, isSigner: false, isWritable: false },
                { pubkey: PYTH_USDC_FEED, isSigner: false, isWritable: false },
                { pubkey: KLEND_PROGRAM, isSigner: false, isWritable: false },
                { pubkey: KLEND_PROGRAM, isSigner: false, isWritable: false },
                { pubkey: KLEND_PROGRAM, isSigner: false, isWritable: false },
            ],
            data: require('./common').sighash('refresh_reserve'),
        })

    const bal = async (addr: PublicKey, name: string) => {
        try {
            const a = await getAccount(conn, addr)
            console.log(`  ${name}: ${a.amount}`)
            return a.amount
        } catch {
            console.log(`  ${name}: (none)`)
            return 0n
        }
    }

    console.log('=== balances before')
    await bal(userUsdcAta, 'user tUSDC')
    await bal(tokenVault, 'token_vault')
    await bal(treasury, 'treasury')

    // 1. wrap
    console.log('=== wrap', WRAP_AMOUNT.toString())
    const ataIx = createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, userWrappedAta, admin.publicKey, wrappedMint)
    let sig = await program.methods
        .wrap({ amount: WRAP_AMOUNT } as any)
        .accountsPartial({
            user: admin.publicKey,
            vaultConfig,
            vaultAuthority,
            tokenConfig,
            tokenMint: usdcMint,
            userToken: userUsdcAta,
            userWrapped: userWrappedAta,
            wrappedMint,
            usdcMint,
            allowlist: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenVault,
        } as any)
        .preInstructions([ataIx])
        .rpc()
    console.log('wrap tx:', sig)
    await bal(userWrappedAta, 'user wStable')

    // 2. deposit to KLend
    console.log('=== deposit_to_klend', KLEND_DEPOSIT.toString())
    sig = await program.methods
        .depositToKlend({ amount: KLEND_DEPOSIT } as any)
        .accountsPartial({
            admin: admin.publicKey,
            vaultConfig,
            vaultAuthority,
            tokenConfig,
            tokenVault,
            usdcMint,
            klendProgram: KLEND_PROGRAM,
            lendingMarket: market,
            lendingMarketAuthority,
            baseReserve: reserve,
            reserveLiquiditySupply,
            reserveCollateralMint,
            baseCollateralVault: collateralVault,
            tokenProgram: TOKEN_PROGRAM_ID,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .preInstructions([refreshIx()])
        .rpc()
    console.log('deposit tx:', sig)

    // 3. wait for yield: kToken redeemable value must exceed tracked principal
    console.log('=== waiting for interest accrual (borrower keeps utilization > 0)')
    const SF = 2n ** 60n
    let harvestable = 0n
    let rate = 0
    // Interest accrual is lazy on-chain: reserve state only advances when refresh_reserve
    // runs. Simulate a refresh and read the post-execution reserve account instead of
    // trusting the stale stored snapshot.
    const refreshedReserve = async () => {
        const tx = new anchor.web3.Transaction().add(refreshIx())
        tx.feePayer = admin.publicKey
        tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
        tx.sign(admin)
        const sim = await conn.simulateTransaction(tx, undefined, [reserve])
        const acc = sim.value.accounts?.[0]
        if (!acc) throw new Error('refresh simulation returned no reserve account')
        return sdk.Reserve.decode(Buffer.from(acc.data[0], 'base64'))
    }
    for (let i = 0; i < MAX_POLLS; i++) {
        const res = await refreshedReserve()
        const totalLiq =
            BigInt(res.liquidity.availableAmount.toString()) +
            BigInt(res.liquidity.borrowedAmountSf.toString()) / SF -
            BigInt(res.liquidity.accumulatedProtocolFeesSf.toString()) / SF
        const totalColl = BigInt(res.collateral.mintTotalSupply.toString())
        rate = Number(totalLiq) / Number(totalColl)
        const ourKTokens = (await getAccount(conn, collateralVault)).amount
        const tracked = BigInt((await (program.account as any).tokenConfig.fetch(tokenConfig)).totalLiquidityInKlend.toString())
        const value = BigInt(Math.floor(Number(ourKTokens) * rate))
        harvestable = value > tracked ? value - tracked : 0n
        console.log(`  poll ${i}: kTokens=${ourKTokens} value=${value} tracked=${tracked} yield=${harvestable}`)
        if (harvestable >= YIELD_THRESHOLD) break
        await sleep(POLL_SECONDS)
    }
    if (harvestable < YIELD_THRESHOLD) throw new Error('yield did not accrue; is the borrower set up (30_borrower.ts)?')

    // 4. harvest ~90% of the accrued yield (leave margin for the backing invariant)
    const collateralToRedeem = BigInt(Math.floor((Number(harvestable) * 0.9) / rate))
    console.log('=== harvest_yield, redeeming', collateralToRedeem.toString(), 'kTokens')
    sig = await program.methods
        .harvestYield({ collateralAmount: new anchor.BN(collateralToRedeem.toString()) } as any)
        .accountsPartial({
            admin: admin.publicKey,
            vaultConfig,
            vaultAuthority,
            tokenConfig,
            tokenMint: usdcMint,
            treasury,
            collateralVault,
            klendProgram: KLEND_PROGRAM,
            lendingMarket: market,
            lendingMarketAuthority,
            reserve,
            reserveLiquiditySupply,
            reserveCollateralMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .preInstructions([refreshIx()])
        .rpc()
    console.log('harvest tx:', sig)
    const treasuryBal = await bal(treasury, 'treasury (harvested yield)')
    if (treasuryBal === 0n) throw new Error('harvest succeeded but treasury is empty')

    // 5. withdraw all remaining collateral back to token_vault
    const remainingKTokens = (await getAccount(conn, collateralVault)).amount
    console.log('=== withdraw_from_klend, all', remainingKTokens.toString(), 'kTokens')
    sig = await program.methods
        .withdrawFromKlend({ collateralAmount: new anchor.BN(remainingKTokens.toString()) } as any)
        .accountsPartial({
            admin: admin.publicKey,
            vaultConfig,
            vaultAuthority,
            tokenConfig,
            baseTokenVault: tokenVault,
            usdcMint,
            klendProgram: KLEND_PROGRAM,
            lendingMarket: market,
            lendingMarketAuthority,
            baseReserve: reserve,
            reserveLiquiditySupply,
            reserveCollateralMint,
            baseCollateralVault: collateralVault,
            tokenProgram: TOKEN_PROGRAM_ID,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .preInstructions([refreshIx()])
        .rpc()
    console.log('withdraw tx:', sig)
    await bal(tokenVault, 'token_vault')

    // 6. unwrap everything the user wrapped
    console.log('=== unwrap', WRAP_AMOUNT.toString())
    sig = await program.methods
        .unwrap({ amount: WRAP_AMOUNT } as any)
        .accountsPartial({
            user: admin.publicKey,
            vaultConfig,
            vaultAuthority,
            userWrapped: userWrappedAta,
            userBaseToken: userUsdcAta,
            wrappedMint,
            usdcMint,
            baseTokenConfig: tokenConfig,
            baseTokenVault: tokenVault,
            allowlist: null,
            tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc()
    console.log('unwrap tx:', sig)

    console.log('=== balances after')
    await bal(userUsdcAta, 'user tUSDC')
    await bal(userWrappedAta, 'user wStable')
    await bal(tokenVault, 'token_vault')
    await bal(treasury, 'treasury (yield stays here)')
    console.log('FULL FLOW PASSED — positive harvest included')
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
