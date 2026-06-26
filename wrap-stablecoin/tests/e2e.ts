import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "node:fs";
import { expect } from "chai";
import * as crypto from "node:crypto";
import { WrapStablecoin } from "../target/types/wrap_stablecoin";
import {
  ALLOWLIST_SEED,
  ASSET_CONFIG_SEED,
  COLLATERAL_VAULT_SEED,
  KLEND_CONFIG_SEED,
  KLEND_LENDING_MARKET_AUTH_SEED,
  TOKEN_VAULT_SEED,
  TREASURY_VAULT_SEED,
  VAULT_AUTHORITY_SEED,
  VAULT_CONFIG_SEED,
  WRAPPED_MINT_SEED,
} from "./pda-seeds";

// Mainnet Kamino Main Market USDC reserve (cloned into local validator by
// fixtures/klend/*.json — see Anchor.toml).
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const KLEND_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);
const LENDING_MARKET = new PublicKey(
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
);
const USDC_RESERVE = new PublicKey(
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
);
const RESERVE_LIQUIDITY_SUPPLY = new PublicKey(
  "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
);
const RESERVE_COLLATERAL_MINT = new PublicKey(
  "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D",
);
const SCOPE_PRICES = new PublicKey(
  "3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH",
);

function anchorSighash(name: string): Buffer {
  const preimage = `global:${name}`;
  const hash = crypto.createHash("sha256").update(preimage).digest();
  return hash.subarray(0, 8);
}

/**
 * KLend's refresh_reserve instruction. Must be invoked as its own ix before
 * deposit/redeem in the same transaction so reserve.last_update is current.
 */
function refreshReserveIx(): TransactionInstruction {
  const NONE = KLEND_PROGRAM_ID;
  return new TransactionInstruction({
    programId: KLEND_PROGRAM_ID,
    keys: [
      { pubkey: USDC_RESERVE, isSigner: false, isWritable: true },
      { pubkey: LENDING_MARKET, isSigner: false, isWritable: false },
      { pubkey: NONE, isSigner: false, isWritable: false },
      { pubkey: NONE, isSigner: false, isWritable: false },
      { pubkey: NONE, isSigner: false, isWritable: false },
      { pubkey: SCOPE_PRICES, isSigner: false, isWritable: false },
    ],
    data: anchorSighash("refresh_reserve"),
  });
}

function lendingMarketAuthorityPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(KLEND_LENDING_MARKET_AUTH_SEED), LENDING_MARKET.toBuffer()],
    KLEND_PROGRAM_ID,
  );
  return pda;
}

function vaultConfigPda(
  programId: PublicKey,
  authority: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_CONFIG_SEED), authority.toBuffer()],
    programId,
  );
  return pda;
}

function vaultAuthorityPda(
  programId: PublicKey,
  vaultConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTHORITY_SEED), vaultConfig.toBuffer()],
    programId,
  );
  return pda;
}

function wrappedMintPda(
  programId: PublicKey,
  vaultConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(WRAPPED_MINT_SEED), vaultConfig.toBuffer()],
    programId,
  );
  return pda;
}

function tokenConfigPda(
  programId: PublicKey,
  vaultConfig: PublicKey,
  tokenMint: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(ASSET_CONFIG_SEED),
      vaultConfig.toBuffer(),
      tokenMint.toBuffer(),
    ],
    programId,
  );
  return pda;
}

function collateralVaultPda(
  programId: PublicKey,
  tokenConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(COLLATERAL_VAULT_SEED), tokenConfig.toBuffer()],
    programId,
  );
  return pda;
}

function tokenVaultPda(
  programId: PublicKey,
  tokenConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_VAULT_SEED), tokenConfig.toBuffer()],
    programId,
  );
  return pda;
}

function treasuryVaultPda(
  programId: PublicKey,
  assetConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_VAULT_SEED), assetConfig.toBuffer()],
    programId,
  );
  return pda;
}

function allowlistPda(
  programId: PublicKey,
  vaultConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ALLOWLIST_SEED), vaultConfig.toBuffer()],
    programId,
  );
  return pda;
}

function klendConfigPda(
  programId: PublicKey,
  assetConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(KLEND_CONFIG_SEED), assetConfig.toBuffer()],
    programId,
  );
  return pda;
}

describe("e2e: wrap/unwrap + KLend against cloned mainnet state", () => {
  const walletSecret = JSON.parse(
    fs.readFileSync("fixtures/user/wallet.json", "utf8"),
  );
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletSecret));

  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ??
    process.env.SOLANA_RPC_URL ??
    "http://127.0.0.1:8901";
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.wrapStablecoin as Program<WrapStablecoin>;
  const programId = program.programId;

  const vaultConfig = vaultConfigPda(programId, wallet.publicKey);
  const vaultAuthority = vaultAuthorityPda(programId, vaultConfig);
  const wrappedMint = wrappedMintPda(programId, vaultConfig);
  const tokenConfig = tokenConfigPda(programId, vaultConfig, USDC_MINT);
  const klendConfig = klendConfigPda(programId, tokenConfig);
  const collateralVault = collateralVaultPda(programId, tokenConfig);
  const tokenVault = tokenVaultPda(programId, tokenConfig);
  const treasuryVault = treasuryVaultPda(programId, tokenConfig);
  const lendingMarketAuthority = lendingMarketAuthorityPda();
  const allowlist = allowlistPda(programId, vaultConfig);
  const userUsdcAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    wallet.publicKey,
  );
  const userWrappedAta = getAssociatedTokenAddressSync(
    wrappedMint,
    wallet.publicKey,
    true,
  );

  before(async () => {
    console.log(`Wallet          ${wallet.publicKey.toBase58()}`);
    console.log(`Program         ${programId.toBase58()}`);
    console.log(`Vault config    ${vaultConfig.toBase58()}`);
    console.log(`Vault authority ${vaultAuthority.toBase58()}`);
    console.log(`Wrapped mint    ${wrappedMint.toBase58()}`);
    console.log(`Token config    ${tokenConfig.toBase58()}`);
    console.log(`USDC ATA        ${userUsdcAta.toBase58()}`);
    const usdcAccount = await getAccount(connection, userUsdcAta);
    console.log(`USDC balance    ${usdcAccount.amount.toString()} (raw)`);
  });

  it("initializes the vault", async () => {
    const existing = await connection.getAccountInfo(vaultConfig);
    if (existing !== null) {
      const vaultData = await (program.account as any).vaultConfig.fetch(
        vaultConfig,
      );
      expect(vaultData.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
      console.log(
        `vault already initialized (assetCount=${vaultData.assetCount}, e.g. from cross_asset)`,
      );
      return;
    }

    const txSig = await program.methods
      .initialize()
      .accountsPartial({
        authority: wallet.publicKey,
        decimalsMint: USDC_MINT,
        vaultConfig,
        wrappedMint,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`initialize tx: ${txSig}`);

    const vaultData = await (program.account as any).vaultConfig.fetch(
      vaultConfig,
    );
    expect(vaultData.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
    expect(vaultData.assetCount).to.equal(0);
  });

  it("registers USDC via add_asset", async () => {
    const existing = await connection.getAccountInfo(tokenConfig);
    if (existing === null) {
      const txSig = await program.methods
        .addAsset({ mintEnabled: true, redeemEnabled: true } as any)
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          underlyingMint: USDC_MINT,
          assetConfig: tokenConfig,
          tokenVault,
          treasuryVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      console.log(`add_asset tx: ${txSig}`);
    } else {
      console.log("USDC asset_config already exists (skip add_asset)");
    }

    const vaultData = await (program.account as any).vaultConfig.fetch(
      vaultConfig,
    );
    const registered = vaultData.registeredAssets.map((m: PublicKey) =>
      m.toBase58(),
    );
    expect(registered).to.include(USDC_MINT.toBase58());
    const assetData = await (program.account as any).assetConfig.fetch(
      tokenConfig,
    );
    expect(assetData.treasuryVault.toBase58()).to.equal(
      treasuryVault.toBase58(),
    );
  });

  it("enables KLend for USDC", async () => {
    const txSig = await program.methods
      .enableKlend()
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        klendConfig,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority,
        reserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        collateralMint: RESERVE_COLLATERAL_MINT,
        collateralVault,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`enable_klend tx: ${txSig}`);

    const klendData = await program.account.kLendConfig.fetch(klendConfig);
    expect(klendData.assetConfig.toBase58()).to.equal(tokenConfig.toBase58());
  });

  it("wraps 100 USDC", async () => {
    const ataIx = createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      userWrappedAta,
      wallet.publicKey,
      wrappedMint,
    );

    const amount = new anchor.BN(100_000_000);
    const txSig = await program.methods
      .wrap({ amount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        tokenMint: USDC_MINT,
        userToken: userUsdcAta,
        userWrapped: userWrappedAta,
        wrappedMint,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .preInstructions([ataIx])
      .rpc();
    console.log(`wrap tx: ${txSig}`);

    const wrappedBal = await getAccount(connection, userWrappedAta);
    expect(wrappedBal.amount.toString()).to.equal("100000000");

    const tokenVaultBal = await getAccount(connection, tokenVault);
    expect(tokenVaultBal.amount.toString()).to.equal("100000000");

    const assetCfg = await program.account.assetConfig.fetch(tokenConfig);
    expect(assetCfg.totalWrappedMinted.toString()).to.equal("100000000");
    expect(assetCfg.totalRedemptions.toString()).to.equal("0");
  });

  it("deposits 50 USDC into KLend", async () => {
    const amount = new anchor.BN(50_000_000);
    const txSig = await program.methods
      .depositToKlend({ amount } as any)
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        klendConfig,
        tokenVault,
        tokenMint: USDC_MINT,
        klendProgram: KLEND_PROGRAM_ID,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority,
        reserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        reserveCollateralMint: RESERVE_COLLATERAL_MINT,
        collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .preInstructions([refreshReserveIx()])
      .rpc();
    console.log(`deposit_to_klend tx: ${txSig}`);

    const cfg = await program.account.kLendConfig.fetch(klendConfig);
    expect(cfg.totalLiquidityInKlend.toString()).to.equal("50000000");

    const vaultBal = await getAccount(connection, tokenVault);
    expect(Number(vaultBal.amount)).to.be.closeTo(50_000_000, 1);
    const collateralBal = await getAccount(connection, collateralVault);
    expect(Number(collateralBal.amount)).to.be.greaterThan(0);
  });

  it("rejects harvest_yield that would leave the vault underbacked", async () => {
    // Snapshot state: 50 USDC deposited, backed by ~kTokens at current exchange rate.
    // Since no new interest has accrued within this test run, redeeming any collateral
    // leaves remaining value < total_liquidity_in_klend — the invariant must trip.
    const collateralBal = await getAccount(connection, collateralVault);
    expect(Number(collateralBal.amount)).to.be.greaterThan(0);

    let threw = false;
    try {
      await program.methods
        .harvestYield({ collateralAmount: new anchor.BN(1) } as any)
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          assetConfig: tokenConfig,
          klendConfig,
          tokenMint: USDC_MINT,
          treasuryVault,
          collateralVault,
          klendProgram: KLEND_PROGRAM_ID,
          lendingMarket: LENDING_MARKET,
          lendingMarketAuthority,
          reserve: USDC_RESERVE,
          reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
          reserveCollateralMint: RESERVE_COLLATERAL_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          collateralTokenProgram: TOKEN_PROGRAM_ID,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        } as any)
        .preInstructions([refreshReserveIx()])
        .rpc();
    } catch (err: any) {
      threw = true;
      const msg = err?.error?.errorCode?.code || err?.message || String(err);
      console.log(`harvest_yield rejected as expected: ${msg}`);
      expect(msg).to.match(/HarvestLeaves|HarvestRedeemedNothing|Simulation|Math/);
    }
    expect(threw).to.equal(true);
  });

  it("rejects unwrap when token_vault lacks free liquidity", async () => {
    const vaultBal = await getAccount(connection, tokenVault);
    expect(Number(vaultBal.amount)).to.be.closeTo(50_000_000, 1);

    const amount = new anchor.BN(60_000_000);
    let threw = false;
    try {
      await program.methods
        .unwrap({ amount } as any)
        .accountsPartial({
          user: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          userWrapped: userWrappedAta,
          userAssetToken: userUsdcAta,
          wrappedMint,
          assetConfig: tokenConfig,
          tokenMint: USDC_MINT,
          tokenVault,
          allowlist: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc();
    } catch (err: any) {
      threw = true;
      const msg = err?.error?.errorCode?.code || err?.message || String(err);
      console.log(`unwrap rejected as expected: ${msg}`);
      expect(msg).to.match(/InsufficientLiquidity/);
    }
    expect(threw).to.equal(true);
  });

  it("admin withdraw_from_klend refills vault before user unwrap", async () => {
    const collateralBal = await getAccount(connection, collateralVault);
    const collateralAmount = new anchor.BN(
      Math.floor(Number(collateralBal.amount) / 2),
    );

    const withdrawSig = await program.methods
      .withdrawFromKlend({ collateralAmount } as any)
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        klendConfig,
        tokenVault,
        tokenMint: USDC_MINT,
        klendProgram: KLEND_PROGRAM_ID,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority,
        reserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        reserveCollateralMint: RESERVE_COLLATERAL_MINT,
        collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .preInstructions([refreshReserveIx()])
      .rpc();
    console.log(`withdraw_from_klend tx: ${withdrawSig}`);

    const vaultBal = await getAccount(connection, tokenVault);
    expect(Number(vaultBal.amount)).to.be.greaterThan(60_000_000);

    const usdcBefore = (await getAccount(connection, userUsdcAta)).amount;
    const wrappedBefore = (await getAccount(connection, userWrappedAta)).amount;
    const amount = new anchor.BN(60_000_000);

    const unwrapSig = await program.methods
      .unwrap({ amount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        userWrapped: userWrappedAta,
        userAssetToken: userUsdcAta,
        wrappedMint,
        assetConfig: tokenConfig,
        tokenMint: USDC_MINT,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
    console.log(`unwrap (vault-only) tx: ${unwrapSig}`);

    const usdcAfter = (await getAccount(connection, userUsdcAta)).amount;
    const wrappedAfter = (await getAccount(connection, userWrappedAta)).amount;
    expect(Number(usdcAfter - usdcBefore)).to.equal(60_000_000);
    expect((wrappedBefore - wrappedAfter).toString()).to.equal(
      amount.toString(),
    );
  });

  it("admin withdraw_all_from_klend drains remaining Kamino position", async () => {
    const collateralBal = await getAccount(connection, collateralVault);
    if (collateralBal.amount === 0n) {
      console.log("skip withdraw_all_from_klend: no collateral left");
      return;
    }
    const txSig = await program.methods
      .withdrawAllFromKlend()
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        klendConfig,
        tokenVault,
        tokenMint: USDC_MINT,
        klendProgram: KLEND_PROGRAM_ID,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority,
        reserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        reserveCollateralMint: RESERVE_COLLATERAL_MINT,
        collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .preInstructions([refreshReserveIx()])
      .rpc();
    console.log(`withdraw_all_from_klend tx: ${txSig}`);

    const collateralAfter = await getAccount(connection, collateralVault);
    expect(collateralAfter.amount.toString()).to.equal("0");
  });

  it("rejects unwrap exceeding pool liability", async () => {
    const cfg = await program.account.assetConfig.fetch(tokenConfig);
    const liability = cfg.totalWrappedMinted.sub(cfg.totalRedemptions);
    expect(Number(liability)).to.be.greaterThan(0);

    const amount = liability.add(new anchor.BN(1_000_000));
    let threw = false;
    try {
      await program.methods
        .unwrap({ amount } as any)
        .accountsPartial({
          user: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          userWrapped: userWrappedAta,
          userAssetToken: userUsdcAta,
          wrappedMint,
          assetConfig: tokenConfig,
          tokenMint: USDC_MINT,
          tokenVault,
          allowlist: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc();
    } catch (err: any) {
      threw = true;
      const msg = err?.error?.errorCode?.code || err?.message || String(err);
      console.log(`unwrap liability cap rejected as expected: ${msg}`);
      // Single-pool vault: amount > liability may hit global InsufficientBalance first.
      expect(msg).to.match(/InsufficientLiability|InsufficientBalance/);
    }
    expect(threw).to.equal(true);
  });

  it("admin sweep_home_surplus moves excess home vault to treasury", async () => {
    const cfg = await program.account.assetConfig.fetch(tokenConfig);
    const liability = cfg.totalWrappedMinted.sub(cfg.totalRedemptions);
    const vaultBal = await getAccount(connection, tokenVault);
    const liabilityUnderlying = Number(liability);
    const surplus = Number(vaultBal.amount) - liabilityUnderlying;
    if (surplus <= 0) {
      console.log("skip sweep_home_surplus: no home surplus in this fixture state");
      return;
    }

    const sweepAmount = new anchor.BN(Math.min(surplus, 1_000_000));
    const treasuryBefore = (await getAccount(connection, treasuryVault)).amount;

    const txSig = await program.methods
      .sweepHomeSurplus({ amount: sweepAmount } as any)
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        tokenMint: USDC_MINT,
        tokenVault,
        treasuryVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
    console.log(`sweep_home_surplus tx: ${txSig}`);

    const treasuryAfter = (await getAccount(connection, treasuryVault)).amount;
    expect((treasuryAfter - treasuryBefore).toString()).to.equal(
      sweepAmount.toString(),
    );
  });

  it("unwraps Florin (FLRN) when only home vault has liquidity", async () => {
    const wrapAmount = new anchor.BN(10_000_000);
    await program.methods
      .wrap({ amount: wrapAmount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tokenConfig,
        tokenMint: USDC_MINT,
        userToken: userUsdcAta,
        userWrapped: userWrappedAta,
        wrappedMint,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();

    const usdcBefore = (await getAccount(connection, userUsdcAta)).amount;
    const wrappedBefore = (await getAccount(connection, userWrappedAta)).amount;
    const amount = wrapAmount;

    const txSig = await program.methods
      .unwrap({ amount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        userWrapped: userWrappedAta,
        userAssetToken: userUsdcAta,
        wrappedMint,
        assetConfig: tokenConfig,
        tokenMint: USDC_MINT,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
    console.log(`unwrap (home vault only) tx: ${txSig}`);

    const usdcAfter = (await getAccount(connection, userUsdcAta)).amount;
    const wrappedAfter = (await getAccount(connection, userWrappedAta)).amount;
    expect((usdcAfter - usdcBefore).toString()).to.equal(amount.toString());
    expect((wrappedBefore - wrappedAfter).toString()).to.equal(
      amount.toString(),
    );
  });

  describe("admin flows", () => {
    it("pauses and unpauses the vault", async () => {
      await program.methods
        .setPaused(true)
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();
      let cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
      expect(cfg.paused).to.equal(true);

      // Wrap must fail while paused.
      let threw = false;
      try {
        await program.methods
          .wrap({ amount: new anchor.BN(1_000_000) } as any)
          .accountsPartial({
            user: wallet.publicKey,
            vaultConfig,
            vaultAuthority,
            assetConfig: tokenConfig,
            tokenMint: USDC_MINT,
            userToken: userUsdcAta,
            userWrapped: userWrappedAta,
            wrappedMint,
            tokenVault,
            allowlist: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .rpc();
      } catch (err: any) {
        threw = true;
        const code = err?.error?.errorCode?.code || "";
        expect(code).to.match(/VaultPaused/);
      }
      expect(threw).to.equal(true);

      await program.methods
        .setPaused(false)
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();
      cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
      expect(cfg.paused).to.equal(false);
    });

    it("proposes, cancels, and completes an admin transfer", async () => {
      const newAdmin = Keypair.generate();
      // Airdrop a little SOL so accept_authority pays rent for transaction fees.
      const airdrop = await connection.requestAirdrop(
        newAdmin.publicKey,
        1_000_000_000,
      );
      await connection.confirmTransaction(airdrop, "confirmed");

      // Propose
      await program.methods
        .transferAuthority()
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          newAdmin: newAdmin.publicKey,
        } as any)
        .rpc();
      let cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
      expect(cfg.pendingAdmin.toBase58()).to.equal(
        newAdmin.publicKey.toBase58(),
      );

      // Cancel
      await program.methods
        .cancelTransferAuthority()
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();
      cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
      expect(cfg.pendingAdmin.toBase58()).to.equal(
        PublicKey.default.toBase58(),
      );

      // Accepting with no pending transfer must fail.
      let threw = false;
      try {
        await program.methods
          .acceptAuthority()
          .accountsPartial({
            newAdmin: newAdmin.publicKey,
            vaultConfig,
          } as any)
          .signers([newAdmin])
          .rpc();
      } catch (err: any) {
        threw = true;
        const code = err?.error?.errorCode?.code || "";
        expect(code).to.match(/NoPendingTransfer/);
      }
      expect(threw).to.equal(true);

      // Propose again, then accept
      await program.methods
        .transferAuthority()
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          newAdmin: newAdmin.publicKey,
        } as any)
        .rpc();
      await program.methods
        .acceptAuthority()
        .accountsPartial({
          newAdmin: newAdmin.publicKey,
          vaultConfig,
        } as any)
        .signers([newAdmin])
        .rpc();
      cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
      expect(cfg.admin.toBase58()).to.equal(newAdmin.publicKey.toBase58());
      expect(cfg.pendingAdmin.toBase58()).to.equal(
        PublicKey.default.toBase58(),
      );

      // Rotate back so later tests keep using the original wallet as admin.
      await program.methods
        .transferAuthority()
        .accountsPartial({
          admin: newAdmin.publicKey,
          vaultConfig,
          newAdmin: wallet.publicKey,
        } as any)
        .signers([newAdmin])
        .rpc();
      await program.methods
        .acceptAuthority()
        .accountsPartial({
          newAdmin: wallet.publicKey,
          vaultConfig,
        } as any)
        .rpc();
      cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
      expect(cfg.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
    });

    it("manages an allowlist and gates private wraps", async () => {
      await program.methods
        .initAllowlist()
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          allowlist,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      const alice = Keypair.generate().publicKey;
      await program.methods
        .addToAllowlist(alice)
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          allowlist,
        } as any)
        .rpc();

      let al = await (program.account as any).allowlist.fetch(allowlist);
      expect(al.allowed.map((k: PublicKey) => k.toBase58())).to.include(
        alice.toBase58(),
      );

      // Duplicate must fail.
      let threw = false;
      try {
        await program.methods
          .addToAllowlist(alice)
          .accountsPartial({
            admin: wallet.publicKey,
            vaultConfig,
            allowlist,
          } as any)
          .rpc();
      } catch (err: any) {
        threw = true;
        expect(err?.error?.errorCode?.code || "").to.match(
          /AllowlistDuplicate/,
        );
      }
      expect(threw).to.equal(true);

      await program.methods
        .removeFromAllowlist(alice)
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          allowlist,
        } as any)
        .rpc();
      al = await (program.account as any).allowlist.fetch(allowlist);
      expect(al.allowed.map((k: PublicKey) => k.toBase58())).to.not.include(
        alice.toBase58(),
      );

      // Flip wrap to private and verify admin can still wrap (admin bypasses allowlist).
      await program.methods
        .setWrapPublic(false)
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();

      const amount = new anchor.BN(1_000_000);
      await program.methods
        .wrap({ amount } as any)
        .accountsPartial({
          user: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          assetConfig: tokenConfig,
          tokenMint: USDC_MINT,
          userToken: userUsdcAta,
          userWrapped: userWrappedAta,
          wrappedMint,
          tokenVault,
          allowlist,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc();

      // Restore public wrap so later runs remain clean.
      await program.methods
        .setWrapPublic(true)
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();
    });

    it("rejects a foreign allowlist PDA used to bypass a private-wrap gate", async () => {
      // Attacker spins up a parallel vault and seeds its allowlist with themselves.
      // Without PDA-derivation checks in `check_access`, they could pass this
      // attacker-controlled allowlist to the victim vault's `wrap` to bypass the gate.
      const attacker = Keypair.generate();
      const airdrop = await connection.requestAirdrop(
        attacker.publicKey,
        2_000_000_000,
      );
      await connection.confirmTransaction(airdrop, "confirmed");

      const atkVault = vaultConfigPda(programId, attacker.publicKey);
      const atkVaultAuthority = vaultAuthorityPda(programId, atkVault);
      const atkWrappedMint = wrappedMintPda(programId, atkVault);
      const atkTokenConfig = tokenConfigPda(programId, atkVault, USDC_MINT);
      const atkCollateralVault = collateralVaultPda(programId, atkTokenConfig);
      const atkTokenVault = tokenVaultPda(programId, atkTokenConfig);
      const atkAllowlist = allowlistPda(programId, atkVault);

      await program.methods
        .initialize()
        .accountsPartial({
          authority: attacker.publicKey,
          decimalsMint: USDC_MINT,
          vaultConfig: atkVault,
          wrappedMint: atkWrappedMint,
          vaultAuthority: atkVaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([attacker])
        .rpc();

      await program.methods
        .initAllowlist()
        .accountsPartial({
          admin: attacker.publicKey,
          vaultConfig: atkVault,
          allowlist: atkAllowlist,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([attacker])
        .rpc();

      await program.methods
        .addToAllowlist(attacker.publicKey)
        .accountsPartial({
          admin: attacker.publicKey,
          vaultConfig: atkVault,
          allowlist: atkAllowlist,
        } as any)
        .signers([attacker])
        .rpc();

      // Gate the victim vault.
      await program.methods
        .setWrapPublic(false)
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();

      const atkUsdcAta = getAssociatedTokenAddressSync(
        USDC_MINT,
        attacker.publicKey,
      );
      const atkWrappedAta = getAssociatedTokenAddressSync(
        wrappedMint,
        attacker.publicKey,
      );
      const atkUsdcAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        attacker.publicKey,
        atkUsdcAta,
        attacker.publicKey,
        USDC_MINT,
      );
      const atkWrappedAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        attacker.publicKey,
        atkWrappedAta,
        attacker.publicKey,
        wrappedMint,
      );

      let threw = false;
      try {
        await program.methods
          .wrap({ amount: new anchor.BN(1_000_000) } as any)
          .accountsPartial({
            user: attacker.publicKey,
            vaultConfig, // victim vault
            vaultAuthority,
            assetConfig: tokenConfig,
            tokenMint: USDC_MINT,
            userToken: atkUsdcAta,
            userWrapped: atkWrappedAta,
            wrappedMint, // victim wrapped mint
            tokenVault,
            usdcMint: USDC_MINT,
            allowlist: atkAllowlist, // foreign allowlist — must be rejected
            tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .preInstructions([atkUsdcAtaIx, atkWrappedAtaIx])
          .signers([attacker])
          .rpc();
      } catch (err: any) {
        threw = true;
        const code = err?.error?.errorCode?.code || err?.message || String(err);
        expect(code).to.match(/NotAllowedToWrap/);
      }
      expect(threw).to.equal(true);

      await program.methods
        .setWrapPublic(true)
        .accountsPartial({ admin: wallet.publicKey, vaultConfig } as any)
        .rpc();
    });
  });
});
