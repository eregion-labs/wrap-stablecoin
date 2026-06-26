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
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
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

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const ONE_M = 1_000_000n;

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

describe("mint authority extraction", () => {
  const walletSecret = JSON.parse(
    fs.readFileSync("fixtures/user/wallet.json", "utf8"),
  );
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletSecret));
  const vaultSeedAuthority = Keypair.generate();
  const newMintAuthority = Keypair.generate();

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

  const vaultConfig = vaultConfigPda(programId, vaultSeedAuthority.publicKey);
  const vaultAuthority = vaultAuthorityPda(programId, vaultConfig);
  const wrappedMint = wrappedMintPda(programId, vaultConfig);
  const assetConfig = assetConfigPda(programId, vaultConfig, USDC_MINT);
  const tokenVault = tokenVaultPda(programId, assetConfig);
  const treasuryVault = treasuryVaultPda(programId, assetConfig);

  const userUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);
  const userWrappedAta = getAssociatedTokenAddressSync(
    wrappedMint,
    wallet.publicKey,
    true,
  );
  const recipientWrappedAta = getAssociatedTokenAddressSync(
    wrappedMint,
    newMintAuthority.publicKey,
    true,
  );

  before(async () => {
    const airdropVaultSeed = await connection.requestAirdrop(
      vaultSeedAuthority.publicKey,
      2_000_000_000,
    );
    await connection.confirmTransaction(airdropVaultSeed, "confirmed");

    const airdropNewMint = await connection.requestAirdrop(
      newMintAuthority.publicKey,
      2_000_000_000,
    );
    await connection.confirmTransaction(airdropNewMint, "confirmed");

    const existing = await connection.getAccountInfo(vaultConfig);
    if (existing !== null) {
      return;
    }

    await program.methods
      .initialize()
      .accountsPartial({
        authority: vaultSeedAuthority.publicKey,
        decimalsMint: USDC_MINT,
        vaultConfig,
        wrappedMint,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([vaultSeedAuthority])
      .rpc();

    await program.methods
      .addAsset({ mintEnabled: true, redeemEnabled: true } as any)
      .accountsPartial({
        admin: vaultSeedAuthority.publicKey,
        vaultConfig,
        vaultAuthority,
        underlyingMint: USDC_MINT,
        assetConfig,
        tokenVault,
        treasuryVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([vaultSeedAuthority])
      .rpc();

    const createWrappedAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      userWrappedAta,
      wallet.publicKey,
      wrappedMint,
    );
    const tx = new anchor.web3.Transaction().add(createWrappedAtaIx);
    await provider.sendAndConfirm(tx);

    await program.methods
      .wrap({ amount: new anchor.BN(Number(ONE_M)) } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig,
        tokenMint: USDC_MINT,
        userToken: userUsdcAta,
        userWrapped: userWrappedAta,
        wrappedMint,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
  });

  it("proposes, cancels, and rejects accept without pending transfer", async () => {
    await program.methods
      .proposeMintAuthority()
      .accountsPartial({
        admin: vaultSeedAuthority.publicKey,
        vaultConfig,
        newMintAuthority: newMintAuthority.publicKey,
      } as any)
      .signers([vaultSeedAuthority])
      .rpc();

    let cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
    expect(cfg.pendingMintAuthority.toBase58()).to.equal(
      newMintAuthority.publicKey.toBase58(),
    );

    await program.methods
      .cancelProposeMintAuthority()
      .accountsPartial({
        admin: vaultSeedAuthority.publicKey,
        vaultConfig,
      } as any)
      .signers([vaultSeedAuthority])
      .rpc();

    cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
    expect(cfg.pendingMintAuthority.toBase58()).to.equal(
      PublicKey.default.toBase58(),
    );

    let threw = false;
    try {
      await program.methods
        .acceptMintAuthority()
        .accountsPartial({
          newMintAuthority: newMintAuthority.publicKey,
          vaultConfig,
          wrappedMint,
          vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .remainingAccounts([])
        .signers([newMintAuthority])
        .rpc();
    } catch (err: any) {
      threw = true;
      const code = err?.error?.errorCode?.code || "";
      expect(code).to.match(/NoPendingMintAuthorityTransfer/);
    }
    expect(threw).to.equal(true);
  });

  it("accepts mint authority, disables wrap, and preserves unwrap", async () => {
    const vaultBefore = await (program.account as any).vaultConfig.fetch(
      vaultConfig,
    );
    const liabilityBefore = vaultBefore.totalStableDeposited.toString();
    const wrappedBefore = (
      await getAccount(connection, userWrappedAta)
    ).amount.toString();

    await program.methods
      .proposeMintAuthority()
      .accountsPartial({
        admin: vaultSeedAuthority.publicKey,
        vaultConfig,
        newMintAuthority: newMintAuthority.publicKey,
      } as any)
      .signers([vaultSeedAuthority])
      .rpc();

    await program.methods
      .acceptMintAuthority()
      .accountsPartial({
        newMintAuthority: newMintAuthority.publicKey,
        vaultConfig,
        wrappedMint,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .remainingAccounts([
        { pubkey: assetConfig, isWritable: true, isSigner: false },
      ])
      .signers([newMintAuthority])
      .rpc();

    const cfg = await (program.account as any).vaultConfig.fetch(vaultConfig);
    expect(cfg.mintAuthorityTransferred).to.equal(true);
    expect(cfg.pendingMintAuthority.toBase58()).to.equal(
      PublicKey.default.toBase58(),
    );

    const asset = await (program.account as any).assetConfig.fetch(assetConfig);
    expect(asset.mintEnabled).to.equal(false);

    const mintInfo = await getMint(connection, wrappedMint);
    expect(mintInfo.mintAuthority?.toBase58()).to.equal(
      newMintAuthority.publicKey.toBase58(),
    );

    let wrapFailed = false;
    try {
      await program.methods
        .wrap({ amount: new anchor.BN(Number(ONE_M)) } as any)
        .accountsPartial({
          user: wallet.publicKey,
          vaultConfig,
          vaultAuthority,
          assetConfig,
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
      wrapFailed = true;
      const code = err?.error?.errorCode?.code || "";
      expect(code).to.match(/MintAuthorityTransferred/);
    }
    expect(wrapFailed).to.equal(true);

    const redeemAmount = new anchor.BN(Number(ONE_M / 2n));
    await program.methods
      .unwrap({ amount: redeemAmount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig,
        tokenMint: USDC_MINT,
        userWrapped: userWrappedAta,
        userAssetToken: userUsdcAta,
        wrappedMint,
        tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();

    const vaultAfter = await (program.account as any).vaultConfig.fetch(
      vaultConfig,
    );
    expect(vaultAfter.totalStableDeposited.toString()).to.equal(
      (BigInt(liabilityBefore) - BigInt(redeemAmount.toString())).toString(),
    );
    expect(
      (await getAccount(connection, userWrappedAta)).amount.toString(),
    ).to.equal(
      (BigInt(wrappedBefore) - BigInt(redeemAmount.toString())).toString(),
    );

    const createRecipientAtaIx =
      createAssociatedTokenAccountIdempotentInstruction(
        newMintAuthority.publicKey,
        recipientWrappedAta,
        newMintAuthority.publicKey,
        wrappedMint,
      );
    const mintIx = createMintToInstruction(
      wrappedMint,
      recipientWrappedAta,
      newMintAuthority.publicKey,
      Number(ONE_M / 4n),
    );
    const mintTx = new anchor.web3.Transaction().add(
      createRecipientAtaIx,
      mintIx,
    );
    await provider.sendAndConfirm(mintTx, [newMintAuthority]);

    const recipientBalance = (
      await getAccount(connection, recipientWrappedAta)
    ).amount.toString();
    expect(recipientBalance).to.equal((ONE_M / 4n).toString());
  });
});
