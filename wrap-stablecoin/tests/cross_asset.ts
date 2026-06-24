import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "node:fs";
import { expect } from "chai";
import { WrapStablecoin } from "../target/types/wrap_stablecoin";
import {
  ASSET_CONFIG_SEED,
  TOKEN_VAULT_SEED,
  TREASURY_VAULT_SEED,
  VAULT_AUTHORITY_SEED,
  VAULT_CONFIG_SEED,
  WRAPPED_MINT_SEED,
} from "./pda-seeds";
import {
  CCC_MINT,
  HALF_M,
  ONE_HM,
  ONE_M,
  ONE_UNIT,
  TTT_MINT,
  bootstrapDummyMints,
  expectInsufficientLiabilityOnly,
  fundTokenVault,
  netLiability,
} from "./dummy_tokens";

function vaultConfigPda(programId: PublicKey, authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_CONFIG_SEED), authority.toBuffer()],
    programId,
  );
  return pda;
}

function vaultAuthorityPda(programId: PublicKey, vaultConfig: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTHORITY_SEED), vaultConfig.toBuffer()],
    programId,
  );
  return pda;
}

function wrappedMintPda(programId: PublicKey, vaultConfig: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(WRAPPED_MINT_SEED), vaultConfig.toBuffer()],
    programId,
  );
  return pda;
}

function assetConfigPda(
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

function tokenVaultPda(programId: PublicKey, assetConfig: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_VAULT_SEED), assetConfig.toBuffer()],
    programId,
  );
  return pda;
}

function treasuryVaultPda(programId: PublicKey, assetConfig: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_VAULT_SEED), assetConfig.toBuffer()],
    programId,
  );
  return pda;
}

function bn(n: bigint): anchor.BN {
  return new anchor.BN(n.toString());
}

describe("cross-asset: CCC / TTT per-pool liability doctrine", () => {
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

  const cccConfig = assetConfigPda(programId, vaultConfig, CCC_MINT);
  const tttConfig = assetConfigPda(programId, vaultConfig, TTT_MINT);
  const cccTokenVault = tokenVaultPda(programId, cccConfig);
  const tttTokenVault = tokenVaultPda(programId, tttConfig);
  const tttTreasuryVault = treasuryVaultPda(programId, tttConfig);

  const userWrappedAta = getAssociatedTokenAddressSync(
    wrappedMint,
    wallet.publicKey,
    true,
  );
  const userCccAta = getAssociatedTokenAddressSync(CCC_MINT, wallet.publicKey);
  const userTttAta = getAssociatedTokenAddressSync(TTT_MINT, wallet.publicKey);

  async function fetchAsset(mint: PublicKey) {
    const cfg = assetConfigPda(programId, vaultConfig, mint);
    return program.account.assetConfig.fetch(cfg);
  }

  async function vaultBalance(vault: PublicKey): Promise<bigint> {
    return BigInt((await getAccount(connection, vault)).amount.toString());
  }

  async function ensureWrappedAta(): Promise<void> {
    const ix = createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      userWrappedAta,
      wallet.publicKey,
      wrappedMint,
    );
    const tx = new anchor.web3.Transaction().add(ix);
    await provider.sendAndConfirm(tx);
  }

  async function wrapVia(
    mint: PublicKey,
    assetConfig: PublicKey,
    tokenVault: PublicKey,
    userToken: PublicKey,
    amount: bigint,
  ): Promise<void> {
    await ensureWrappedAta();
    await program.methods
      .wrap({ amount: bn(amount) } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig,
        tokenMint: mint,
        userToken,
        userWrapped: userWrappedAta,
        wrappedMint,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
  }

  async function unwrapVia(
    mint: PublicKey,
    assetConfig: PublicKey,
    tokenVault: PublicKey,
    userToken: PublicKey,
    amount: bigint,
  ): Promise<void> {
    await program.methods
      .unwrap({ amount: bn(amount) } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        userWrapped: userWrappedAta,
        userAssetToken: userToken,
        wrappedMint,
        assetConfig,
        tokenMint: mint,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
  }

  before(async () => {
    await bootstrapDummyMints(connection, wallet);

    const vaultInfo = await connection.getAccountInfo(vaultConfig);
    if (vaultInfo === null) {
      await program.methods
        .initialize()
        .accountsPartial({
          authority: wallet.publicKey,
          decimalsMint: CCC_MINT,
          vaultConfig,
          wrappedMint,
          vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
    }

    for (const [mint, assetConfig, tokenVault, treasuryVault] of [
      [CCC_MINT, cccConfig, cccTokenVault, treasuryVaultPda(programId, cccConfig)],
      [TTT_MINT, tttConfig, tttTokenVault, tttTreasuryVault],
    ] as const) {
      const info = await connection.getAccountInfo(assetConfig);
      if (info !== null) continue;
      await program.methods
        .addAsset({ mintEnabled: true, redeemEnabled: true } as any)
        .accountsPartial({
          admin: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          underlyingMint: mint,
          assetConfig,
          tokenVault,
          treasuryVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
    }

    await ensureWrappedAta();
  });

  it("wrap raises CCC liability", async () => {
    await wrapVia(CCC_MINT, cccConfig, cccTokenVault, userCccAta, ONE_M);

    const cfg = await fetchAsset(CCC_MINT);
    expect(netLiability(cfg)).to.equal(ONE_M);
    expect(await vaultBalance(cccTokenVault)).to.equal(ONE_M);
  });

  it("wrap raises TTT liability only", async () => {
    const cccBefore = netLiability(await fetchAsset(CCC_MINT));

    await wrapVia(TTT_MINT, tttConfig, tttTokenVault, userTttAta, ONE_HM);

    const tttCfg = await fetchAsset(TTT_MINT);
    expect(netLiability(tttCfg)).to.equal(ONE_HM);
    expect(netLiability(await fetchAsset(CCC_MINT))).to.equal(cccBefore);
  });

  it("liability fails while liquidity passes (unwrap via TTT)", async () => {
    const unwrapAmount = ONE_M + ONE_HM;
    const liability = netLiability(await fetchAsset(TTT_MINT));
    expect(liability < unwrapAmount).to.be.true;

    let vaultBal = await vaultBalance(tttTokenVault);
    const topUp = unwrapAmount - vaultBal + 1n;
    if (topUp > 0n) {
      await fundTokenVault(connection, wallet, TTT_MINT, tttTokenVault, topUp);
      vaultBal = await vaultBalance(tttTokenVault);
    }

    expect(vaultBal > unwrapAmount).to.be.true;
    expect(netLiability(await fetchAsset(TTT_MINT)) < unwrapAmount).to.be.true;

    let threw = false;
    try {
      await unwrapVia(
        TTT_MINT,
        tttConfig,
        tttTokenVault,
        userTttAta,
        unwrapAmount,
      );
    } catch (err) {
      threw = true;
      expectInsufficientLiabilityOnly(err);
    }
    expect(threw).to.equal(true);
  });

  it("redeems within TTT liability", async () => {
    await unwrapVia(TTT_MINT, tttConfig, tttTokenVault, userTttAta, ONE_HM);

    const tttCfg = await fetchAsset(TTT_MINT);
    expect(netLiability(tttCfg)).to.equal(0n);
    expect(netLiability(await fetchAsset(CCC_MINT))).to.equal(ONE_M);
  });

  it("surplus vault balance is not user-redeemable", async () => {
    const cfg = await fetchAsset(TTT_MINT);
    expect(netLiability(cfg)).to.equal(0n);

    const current = await vaultBalance(tttTokenVault);
    if (current < HALF_M) {
      await fundTokenVault(
        connection,
        wallet,
        TTT_MINT,
        tttTokenVault,
        HALF_M - current,
      );
    }
    expect(Number(await vaultBalance(tttTokenVault))).to.be.at.least(Number(HALF_M));
    expect(netLiability(await fetchAsset(TTT_MINT))).to.equal(0n);

    let threw = false;
    try {
      await unwrapVia(
        TTT_MINT,
        tttConfig,
        tttTokenVault,
        userTttAta,
        ONE_UNIT,
      );
    } catch (err) {
      threw = true;
      expectInsufficientLiabilityOnly(err);
    }
    expect(threw).to.equal(true);
  });

  it("admin sweep_home_surplus moves surplus to treasury", async () => {
    const cfg = await fetchAsset(TTT_MINT);
    expect(netLiability(cfg)).to.equal(0n);

    const vaultBefore = await vaultBalance(tttTokenVault);
    const treasuryBefore = await vaultBalance(tttTreasuryVault);
    const sweepAmount = vaultBefore > 0n ? vaultBefore : HALF_M;
    if (sweepAmount === 0n) {
      throw new Error("expected TTT home surplus to sweep");
    }

    await program.methods
      .sweepHomeSurplus({ amount: bn(sweepAmount) } as any)
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig: tttConfig,
        tokenMint: TTT_MINT,
        tokenVault: tttTokenVault,
        treasuryVault: tttTreasuryVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();

    expect(await vaultBalance(tttTokenVault)).to.equal(vaultBefore - sweepAmount);
    expect(await vaultBalance(tttTreasuryVault)).to.equal(
      treasuryBefore + sweepAmount,
    );
    expect(netLiability(await fetchAsset(TTT_MINT))).to.equal(0n);

    let threw = false;
    try {
      await unwrapVia(
        TTT_MINT,
        tttConfig,
        tttTokenVault,
        userTttAta,
        ONE_UNIT,
      );
    } catch (err) {
      threw = true;
      expectInsufficientLiabilityOnly(err);
    }
    expect(threw).to.equal(true);
  });

  it("redeems via origin pool CCC", async () => {
    await unwrapVia(CCC_MINT, cccConfig, cccTokenVault, userCccAta, ONE_M);

    const cfg = await fetchAsset(CCC_MINT);
    expect(netLiability(cfg)).to.equal(0n);
  });
});
