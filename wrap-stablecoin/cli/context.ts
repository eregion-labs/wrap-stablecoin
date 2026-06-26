import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "node:fs";
import { WrapStablecoin } from "../target/types/wrap_stablecoin";
import {
  VAULT_AUTHORITY_SEED,
  VAULT_CONFIG_SEED,
  WRAPPED_MINT_SEED,
} from "../tests/pda-seeds";
import { brandingPath, loadBranding, metadataPda, TOKEN_METADATA_PROGRAM_ID } from "./branding";

const RPC_URL =
  process.env.ANCHOR_PROVIDER_URL ||
  process.env.RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "http://127.0.0.1:8901";

const WALLET_PATH =
  process.env.ANCHOR_WALLET ||
  process.env.ANCHOR_WALLET_PATH ||
  ".secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json";

function pda(programId: PublicKey, seeds: Buffer[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function loadKeypair(path: string): Keypair {
  const walletSecret = JSON.parse(fs.readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(walletSecret));
}

export type CliContext = {
  connection: Connection;
  program: Program<WrapStablecoin>;
  authority: Keypair;
  programId: PublicKey;
  vaultConfig: PublicKey;
  vaultAuthority: PublicKey;
  wrappedMint: PublicKey;
};

export async function loadCliContext(): Promise<CliContext> {
  const authority = loadKeypair(WALLET_PATH);
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(authority),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);
  const program = anchor.workspace.wrapStablecoin as Program<WrapStablecoin>;
  const programId = program.programId;
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
  return {
    connection,
    program,
    authority,
    programId,
    vaultConfig,
    vaultAuthority,
    wrappedMint,
  };
}

export { brandingPath, loadBranding, metadataPda, TOKEN_METADATA_PROGRAM_ID };
