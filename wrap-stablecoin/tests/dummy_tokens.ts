import * as fs from "node:fs";
import * as path from "node:path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
} from "@solana/spl-token";
import {
  createInitializeMint2Instruction,
} from "@solana/spl-token";

export const DUMMY_DECIMALS = 6;

/** 1M tokens at 6 decimals */
export const ONE_M = 1_000_000_000_000n;
/** 0.1M tokens at 6 decimals */
export const ONE_HM = 100_000_000_000n;
/** 0.5M tokens at 6 decimals (surplus fixture) */
export const HALF_M = 500_000_000_000n;
/** 100M tokens at 6 decimals — local admin wallet target balance */
export const HUNDRED_M = 100n * ONE_M;
export const LOCAL_ADMIN_DUMMY_SUPPLY = HUNDRED_M;
/** Localnet bootstrap target SOL balance per wallet */
export const LOCAL_SOL_TARGET = 100 * LAMPORTS_PER_SOL;
/** Smallest wStable burn for doctrine tests */
export const ONE_UNIT = 1n;

export const CCC_MINT = new PublicKey(
  "ccc58277Rfo3mCue4aHD3RcUfQzw8PoNSXimfNMnDqu",
);
export const TTT_MINT = new PublicKey(
  "tttv7GkTAwb1pE6J2Gb3xghGcTXfxrk5B7cM8G2QNWR",
);

const DUMMY_DIR = path.join(__dirname, "..", "dummy-tokens");

export type DummySymbol = "CCC" | "TTT";

export function loadMintKeypair(symbol: DummySymbol): Keypair {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(DUMMY_DIR, "manifest.json"), "utf8"),
  ) as {
    tokens: Record<DummySymbol, { keypair: string }>;
  };
  const file = path.join(DUMMY_DIR, manifest.tokens[symbol].keypair);
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8")));
  return Keypair.fromSecretKey(secret);
}

export function netLiability(cfg: {
  totalWrappedMinted: { toString(): string };
  totalRedemptions: { toString(): string };
}): bigint {
  return (
    BigInt(cfg.totalWrappedMinted.toString()) -
    BigInt(cfg.totalRedemptions.toString())
  );
}

/** Top up a wallet to at least `minLamports` via localnet airdrop (idempotent). */
export async function ensureSolBalanceAtLeast(
  connection: Connection,
  pubkey: PublicKey,
  minLamports: number,
): Promise<void> {
  const balance = await connection.getBalance(pubkey);
  if (balance >= minLamports) {
    return;
  }
  const need = minLamports - balance;
  const sig = await connection.requestAirdrop(pubkey, need);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature: sig, ...latest },
    "confirmed",
  );
}

export async function fundLocalnetWallets(
  connection: Connection,
  wallets: PublicKey[],
  minLamports: number = LOCAL_SOL_TARGET,
): Promise<void> {
  for (const pubkey of wallets) {
    await ensureSolBalanceAtLeast(connection, pubkey, minLamports);
  }
}

export async function ensureDummyMint(
  connection: Connection,
  payer: Keypair,
  mintKeypair: Keypair,
  decimals: number = DUMMY_DECIMALS,
): Promise<PublicKey> {
  const mint = mintKeypair.publicKey;
  const info = await connection.getAccountInfo(mint);
  if (info !== null) {
    return mint;
  }

  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mint,
      decimals,
      payer.publicKey,
      null,
      TOKEN_PROGRAM_ID,
    ),
  );
  await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], {
    commitment: "confirmed",
  });
  return mint;
}

export async function ensurePayerTokenBalanceAtLeast(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  minAmount: bigint,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const createAta = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint,
  );

  let current = 0n;
  const ataInfo = await connection.getAccountInfo(ata);
  if (ataInfo !== null) {
    const acct = await getAccount(connection, ata);
    current = BigInt(acct.amount.toString());
  }

  const tx = new Transaction().add(createAta);
  if (current < minAmount) {
    tx.add(
      createMintToInstruction(
        mint,
        ata,
        payer.publicKey,
        minAmount - current,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  if (tx.instructions.length === 1 && current >= minAmount) {
    return ata;
  }

  await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });
  return ata;
}

export async function ensurePayerTokenBalance(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  amount: bigint,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const createAta = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint,
  );
  const mintIx = createMintToInstruction(
    mint,
    ata,
    payer.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID,
  );
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createAta, mintIx),
    [payer],
    { commitment: "confirmed" },
  );
  return ata;
}

/** Mint to payer ATA then transfer into a vault PDA (surplus without wrap). */
export async function fundTokenVault(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  vaultPda: PublicKey,
  amount: bigint,
): Promise<void> {
  const payerAta = await ensurePayerTokenBalance(
    connection,
    payer,
    mint,
    amount,
  );
  const ix = createTransferInstruction(
    payerAta,
    vaultPda,
    payer.publicKey,
    amount,
    [],
    TOKEN_PROGRAM_ID,
  );
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [payer],
    { commitment: "confirmed" },
  );
}

export function anchorErrorCode(err: unknown): string {
  const e = err as {
    error?: { errorCode?: { code?: string } };
    message?: string;
  };
  return e?.error?.errorCode?.code || e?.message || String(err);
}

export function expectInsufficientLiabilityOnly(err: unknown): void {
  const code = anchorErrorCode(err);
  if (!/InsufficientLiability/.test(code)) {
    throw new Error(`expected InsufficientLiability, got: ${code}`);
  }
  if (/InsufficientLiquidity/.test(code)) {
    throw new Error(`got InsufficientLiquidity instead of InsufficientLiability`);
  }
}

export async function bootstrapDummyMints(
  connection: Connection,
  payer: Keypair,
  adminSupply: bigint = ONE_M * 10n,
): Promise<{ ccc: PublicKey; ttt: PublicKey }> {
  const cccKp = loadMintKeypair("CCC");
  const tttKp = loadMintKeypair("TTT");
  const ccc = await ensureDummyMint(connection, payer, cccKp);
  const ttt = await ensureDummyMint(connection, payer, tttKp);
  await ensurePayerTokenBalanceAtLeast(connection, payer, ccc, adminSupply);
  await ensurePayerTokenBalanceAtLeast(connection, payer, ttt, adminSupply);
  return { ccc, ttt };
}
