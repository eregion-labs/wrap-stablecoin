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
import { KaminoTester } from "../target/types/kamino_tester";

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
  // KLend's refresh_reserve expects positional slots for all four oracle
  // sources (pyth, switchboard price, switchboard twap, scope). Unused slots
  // must use the **KLend program ID itself** as the None sentinel — this is
  // how the SDK's generated codec writes Option<Address> on the wire.
  // See node_modules/@kamino-finance/klend-sdk/dist/@codegen/klend/instructions/refreshReserve.js
  const NONE = KLEND_PROGRAM_ID;
  return new TransactionInstruction({
    programId: KLEND_PROGRAM_ID,
    keys: [
      { pubkey: USDC_RESERVE, isSigner: false, isWritable: true },
      { pubkey: LENDING_MARKET, isSigner: false, isWritable: false },
      { pubkey: NONE, isSigner: false, isWritable: false }, // pyth_oracle (unused)
      { pubkey: NONE, isSigner: false, isWritable: false }, // switchboard_price_oracle (unused)
      { pubkey: NONE, isSigner: false, isWritable: false }, // switchboard_twap_oracle (unused)
      { pubkey: SCOPE_PRICES, isSigner: false, isWritable: false },
    ],
    data: anchorSighash("refresh_reserve"),
  });
}

function lendingMarketAuthorityPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("lma"), LENDING_MARKET.toBuffer()],
    KLEND_PROGRAM_ID,
  );
  return pda;
}

function vaultConfigPda(
  programId: PublicKey,
  authority: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config"), authority.toBuffer()],
    programId,
  );
  return pda;
}

function vaultAuthorityPda(
  programId: PublicKey,
  vaultConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), vaultConfig.toBuffer()],
    programId,
  );
  return pda;
}

function wrappedMintPda(
  programId: PublicKey,
  vaultConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("wrapped_mint"), vaultConfig.toBuffer()],
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
      Buffer.from("token_config"),
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
    [Buffer.from("token_collateral_vault"), tokenConfig.toBuffer()],
    programId,
  );
  return pda;
}

function tokenVaultPda(
  programId: PublicKey,
  tokenConfig: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), tokenConfig.toBuffer()],
    programId,
  );
  return pda;
}

describe("e2e: wrap/unwrap + KLend against cloned mainnet state", () => {
  // The test wallet is persisted in fixtures/user/wallet.json and pre-funded in
  // the test validator with 100 SOL + 1M USDC (see Anchor.toml).
  const walletSecret = JSON.parse(
    fs.readFileSync("fixtures/user/wallet.json", "utf8"),
  );
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletSecret));

  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.kaminoTester as Program<KaminoTester>;
  const programId = program.programId;

  // Derived accounts.
  const vaultConfig = vaultConfigPda(programId, wallet.publicKey);
  const vaultAuthority = vaultAuthorityPda(programId, vaultConfig);
  const wrappedMint = wrappedMintPda(programId, vaultConfig);
  const tokenConfig = tokenConfigPda(programId, vaultConfig, USDC_MINT);
  const collateralVault = collateralVaultPda(programId, tokenConfig);
  const tokenVault = tokenVaultPda(programId, tokenConfig);
  const lendingMarketAuthority = lendingMarketAuthorityPda();
  const userUsdcAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    wallet.publicKey,
  );
  const userWrappedAta = getAssociatedTokenAddressSync(
    wrappedMint,
    wallet.publicKey,
    true, // allowOwnerOffCurve — wrapped_mint is a PDA's controlled mint
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

  it("initializes the vault against the cloned USDC reserve", async () => {
    const txSig = await program.methods
      .initialize()
      .accountsPartial({
        authority: wallet.publicKey,
        usdcMint: USDC_MINT,
        vaultConfig,
        wrappedMint,
        vaultAuthority,
        lendingMarket: LENDING_MARKET,
        treasury: wallet.publicKey,
        reserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        collateralMint: RESERVE_COLLATERAL_MINT,
        tokenConfig,
        collateralVault,
        tokenVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`initialize tx: ${txSig}`);

    const vaultData = await (program.account as any).vaultConfig.fetch(
      vaultConfig,
    );
    expect(vaultData.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
    expect(vaultData.usdcMint.toBase58()).to.equal(USDC_MINT.toBase58());
  });

  it("wraps 100 USDC", async () => {
    // Create the user's wStable ATA (program won't do it for us).
    const ataIx = createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      userWrappedAta,
      wallet.publicKey,
      wrappedMint,
    );

    const amount = new anchor.BN(100_000_000); // 100 USDC (6 decimals)
    const txSig = await program.methods
      .wrap({ amount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        tokenConfig,
        tokenMint: USDC_MINT,
        userToken: userUsdcAta,
        userWrapped: userWrappedAta,
        wrappedMint,
        tokenVault,
        usdcMint: USDC_MINT,
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
  });

  it("deposits 50 USDC into KLend", async () => {
    const amount = new anchor.BN(50_000_000);
    const txSig = await program.methods
      .depositToKlend({ amount } as any)
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        tokenConfig,
        tokenVault,
        usdcMint: USDC_MINT,
        klendProgram: KLEND_PROGRAM_ID,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority,
        baseReserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        reserveCollateralMint: RESERVE_COLLATERAL_MINT,
        baseCollateralVault: collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .preInstructions([refreshReserveIx()])
      .rpc();
    console.log(`deposit_to_klend tx: ${txSig}`);

    const cfg = await (program.account as any).tokenConfig.fetch(tokenConfig);
    expect(cfg.totalLiquidityInKlend.toString()).to.equal("50000000");

    const vaultBal = await getAccount(connection, tokenVault);
    expect(vaultBal.amount.toString()).to.equal("50000000");
    const collateralBal = await getAccount(connection, collateralVault);
    expect(Number(collateralBal.amount)).to.be.greaterThan(0);
  });

  it("withdraws from KLend to restore token_vault liquidity", async () => {
    // Redeem enough collateral to put the full 50 USDC back in token_vault.
    // We pass all kTokens currently held; KLend will redeem them at the current
    // rate, leaving any appreciation as harvestable yield.
    const collateralBal = await getAccount(connection, collateralVault);
    const txSig = await program.methods
      .withdrawFromKlend({ collateralAmount: new anchor.BN(collateralBal.amount.toString()) } as any)
      .accountsPartial({
        admin: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        tokenConfig,
        baseTokenVault: tokenVault,
        usdcMint: USDC_MINT,
        klendProgram: KLEND_PROGRAM_ID,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority,
        baseReserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        reserveCollateralMint: RESERVE_COLLATERAL_MINT,
        baseCollateralVault: collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .preInstructions([refreshReserveIx()])
      .rpc();
    console.log(`withdraw_from_klend tx: ${txSig}`);

    // KLend rounds down by 1 unit on redemption — real behavior, not a bug.
    // After round-trip: vault holds 100M - ε USDC where ε is typically 1.
    const vaultBal = await getAccount(connection, tokenVault);
    expect(Number(vaultBal.amount)).to.be.greaterThanOrEqual(99_999_999);
  });

  it("unwraps wStable back to USDC", async () => {
    const usdcBefore = (await getAccount(connection, userUsdcAta)).amount;
    const wrappedBefore = (await getAccount(connection, userWrappedAta)).amount;

    // Unwrap what's actually sitting in token_vault (KLend rounding may leave
    // us 1 unit short of the wrapped supply).
    const vaultBal = await getAccount(connection, tokenVault);
    const amount = new anchor.BN(vaultBal.amount.toString());
    const txSig = await program.methods
      .unwrap({ amount } as any)
      .accountsPartial({
        user: wallet.publicKey,
        vaultConfig,
        vaultAuthority,
        userWrapped: userWrappedAta,
        userBaseToken: userUsdcAta,
        wrappedMint,
        usdcMint: USDC_MINT,
        baseTokenConfig: tokenConfig,
        baseTokenVault: tokenVault,
        allowlist: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
    console.log(`unwrap tx: ${txSig}`);

    const usdcAfter = (await getAccount(connection, userUsdcAta)).amount;
    const wrappedAfter = (await getAccount(connection, userWrappedAta)).amount;
    expect((usdcAfter - usdcBefore).toString()).to.equal(amount.toString());
    expect((wrappedBefore - wrappedAfter).toString()).to.equal(amount.toString());
  });
});
