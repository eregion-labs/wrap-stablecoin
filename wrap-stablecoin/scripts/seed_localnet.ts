/**
 * Idempotent localnet vault bootstrap: fund admin + payer → initialize → add_asset(USDC) → enable_klend.
 * Invoked by `anchor run local` after the test-validator is up.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "node:fs";
import { WrapStablecoin } from "../target/types/wrap_stablecoin";
import {
  bootstrapDummyMints,
  CCC_MINT,
  fundLocalnetWallets,
  LOCAL_ADMIN_DUMMY_SUPPLY,
  LOCAL_SOL_TARGET,
  TTT_MINT,
} from "../tests/dummy_tokens";
import {
  ASSET_CONFIG_SEED,
  COLLATERAL_VAULT_SEED,
  KLEND_CONFIG_SEED,
  KLEND_LENDING_MARKET_AUTH_SEED,
  TOKEN_VAULT_SEED,
  TREASURY_VAULT_SEED,
  VAULT_AUTHORITY_SEED,
  VAULT_CONFIG_SEED,
  WRAPPED_MINT_SEED,
} from "../tests/pda-seeds";

const RPC_URL =
  process.env.ANCHOR_PROVIDER_URL ||
  process.env.RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "http://127.0.0.1:8901";

const WALLET_PATH =
  process.env.ANCHOR_WALLET ||
  process.env.ANCHOR_WALLET_PATH ||
  ".secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json";

const PAYER_WALLET_PATH =
  process.env.PAYER_WALLET_PATH ||
  ".secrets/depxPDoQBS9JXgwVumiJeuaaSU9b8FaCRwEVTaGD1v9.json";

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

function pda(programId: PublicKey, seeds: Buffer[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function lmaPda(): PublicKey {
  return pda(KLEND_PROGRAM_ID, [
    Buffer.from(KLEND_LENDING_MARKET_AUTH_SEED),
    LENDING_MARKET.toBuffer(),
  ]);
}

export type SeedResult = {
  programId: string;
  vaultAuthority: string;
  vaultConfig: string;
  wrappedMint: string;
  assetConfig: string;
  klendConfig: string;
  tokenVault: string;
  treasuryVault: string;
  collateralVault: string;
};

function loadKeypair(path: string): Keypair {
  const walletSecret = JSON.parse(fs.readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(walletSecret));
}

export async function seedLocalnet(): Promise<SeedResult> {
  const authority = loadKeypair(WALLET_PATH);
  const payer = loadKeypair(PAYER_WALLET_PATH);

  const connection = new Connection(RPC_URL, "confirmed");

  console.log(
    `[seed] fund admin + payer to ${LOCAL_SOL_TARGET / 1e9} SOL each…`,
  );
  await fundLocalnetWallets(
    connection,
    [authority.publicKey, payer.publicKey],
    LOCAL_SOL_TARGET,
  );
  console.log(`[seed]   admin ${authority.publicKey.toBase58()}`);
  console.log(`[seed]   payer ${payer.publicKey.toBase58()}`);

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(authority),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.wrapStablecoin as Program<WrapStablecoin>;
  const programId = program.programId;

  console.log("[seed] bootstrap CCC/TTT dummy mints (100M each to admin)…");
  await bootstrapDummyMints(connection, authority, LOCAL_ADMIN_DUMMY_SUPPLY);

  const vaultConfig = pda(programId, [
    Buffer.from(VAULT_CONFIG_SEED),
    authority.publicKey.toBuffer(),
  ]);
  const vaultAuthority = pda(programId, [
    Buffer.from(VAULT_AUTHORITY_SEED),
    vaultConfig.toBuffer(),
  ]);
  const wrappedMint = pda(programId, [
    Buffer.from(WRAPPED_MINT_SEED),
    vaultConfig.toBuffer(),
  ]);
  const assetConfig = pda(programId, [
    Buffer.from(ASSET_CONFIG_SEED),
    vaultConfig.toBuffer(),
    USDC_MINT.toBuffer(),
  ]);
  const collateralVault = pda(programId, [
    Buffer.from(COLLATERAL_VAULT_SEED),
    assetConfig.toBuffer(),
  ]);
  const tokenVault = pda(programId, [
    Buffer.from(TOKEN_VAULT_SEED),
    assetConfig.toBuffer(),
  ]);
  const treasuryVault = pda(programId, [
    Buffer.from(TREASURY_VAULT_SEED),
    assetConfig.toBuffer(),
  ]);
  const klendConfig = pda(programId, [
    Buffer.from(KLEND_CONFIG_SEED),
    assetConfig.toBuffer(),
  ]);

  const vaultExists = await connection.getAccountInfo(vaultConfig);
  if (vaultExists === null) {
    console.log("[seed] initialize…");
    const initSig = await program.methods
      .initialize()
      .accountsPartial({
        authority: authority.publicKey,
        decimalsMint: USDC_MINT,
        vaultConfig,
        wrappedMint,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`[seed] initialize tx ${initSig}`);
  } else {
    console.log("[seed] vault_config exists — skip initialize");
  }

  const assetExists = await connection.getAccountInfo(assetConfig);
  if (assetExists === null) {
    console.log("[seed] add_asset(USDC)…");
    const addSig = await program.methods
      .addAsset({ mintEnabled: true, redeemEnabled: true } as any)
      .accountsPartial({
        admin: authority.publicKey,
        vaultConfig,
        vaultAuthority,
        underlyingMint: USDC_MINT,
        assetConfig,
        tokenVault,
        treasuryVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`[seed] add_asset tx ${addSig}`);
  } else {
    console.log("[seed] asset_config exists — skip add_asset");
  }

  const klendExists = await connection.getAccountInfo(klendConfig);
  if (klendExists === null) {
    console.log("[seed] enable_klend(USDC)…");
    const enableSig = await program.methods
      .enableKlend()
      .accountsPartial({
        admin: authority.publicKey,
        vaultConfig,
        vaultAuthority,
        assetConfig,
        klendConfig,
        lendingMarket: LENDING_MARKET,
        lendingMarketAuthority: lmaPda(),
        reserve: USDC_RESERVE,
        reserveLiquiditySupply: RESERVE_LIQUIDITY_SUPPLY,
        collateralMint: RESERVE_COLLATERAL_MINT,
        collateralVault,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`[seed] enable_klend tx ${enableSig}`);
  } else {
    console.log("[seed] klend_config exists — skip enable_klend");
  }

  return {
    programId: programId.toBase58(),
    vaultAuthority: authority.publicKey.toBase58(),
    vaultConfig: vaultConfig.toBase58(),
    wrappedMint: wrappedMint.toBase58(),
    assetConfig: assetConfig.toBase58(),
    klendConfig: klendConfig.toBase58(),
    tokenVault: tokenVault.toBase58(),
    treasuryVault: treasuryVault.toBase58(),
    collateralVault: collateralVault.toBase58(),
  };
}

function printEnvBlock(result: SeedResult) {
  console.log("");
  console.log("─── Localnet env (copy into backend/.env and frontend/.env.local) ───");
  console.log(`SOLANA_RPC_URL=${RPC_URL}`);
  console.log("SOLANA_NETWORK=localnet");
  console.log(`PROGRAM_ID=${result.programId}`);
  console.log(`VAULT_AUTHORITY=${result.vaultAuthority}`);
  console.log(`WRAPPED_MINT=${result.wrappedMint}`);
  console.log(`VAULT_CONFIG=${result.vaultConfig}`);
  console.log(`USDC_ASSET_MINT=${USDC_MINT.toBase58()}`);
  console.log(`CCC_MINT=${CCC_MINT.toBase58()}`);
  console.log(`TTT_MINT=${TTT_MINT.toBase58()}`);
  console.log(`DEFAULT_ASSET_MINT=${USDC_MINT.toBase58()}`);
  console.log("NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080");
  console.log("NEXT_PUBLIC_DEFAULT_NETWORK=localnet");
  console.log("# Backend: set LOCALNET_* vars in backend/.env (see backend/.env.example)");
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log("");
  console.log(`Validator RPC:  ${RPC_URL}  (pid file: .localnet/validator.pid)`);
  console.log(`Stop validator:   anchor run stop-local`);
}

async function main() {
  const result = await seedLocalnet();
  printEnvBlock(result);
  console.log("✓ seed_localnet complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
