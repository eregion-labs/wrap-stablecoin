/**
 * Backend end-to-end smoke test against a running localnet + backend API.
 *
 * Assumes:
 *   - solana-test-validator is running on :8901 (via `anchor run local` or smoke script)
 *     with the fixtures from Anchor.toml (KLend state + fixture wallet).
 *   - The wrap_stablecoin program is deployed.
 *   - The backend API is running on :8080 with
 *       SOLANA_RPC_URL=http://127.0.0.1:8901
 *       SOLANA_NETWORK=localnet
 *       VAULT_AUTHORITY=<fixture wallet pubkey>
 *
 * What it exercises:
 *   1. Initializes the vault (idempotent — skips if already there).
 *   2. Generates a fresh throwaway signer keypair.
 *   3. Airdrops SOL and transfers USDC from the fixture wallet to the signer.
 *   4. POST /v1/tx/issue — signs returned VersionedTransaction with the
 *      throwaway keypair, submits, confirms, asserts wStable balance.
 *   5. POST /v1/tx/redeem — same flow, asserts USDC balance returned.
 *
 * This specifically validates the allowlist-slot sentinel fix in
 * backend/src/wrap_stablecoin/builder.rs — the Anchor program rejects
 * the wrap ix if the optional allowlist account slot is missing.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "node:fs";
import { WrapStablecoin } from "../target/types/wrap_stablecoin";
import { seedLocalnet } from "./seed_localnet";

const BACKEND_BASE = process.env.BACKEND_BASE || "http://127.0.0.1:8080";
const RPC_URL =
  process.env.RPC_URL || process.env.SOLANA_RPC_URL || "http://127.0.0.1:8901";
const SIGNER_OUT = process.env.SIGNER_OUT || "/tmp/smoke-signer.json";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-solana-network": "localnet",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  const walletSecret = JSON.parse(
    fs.readFileSync("fixtures/user/wallet.json", "utf8"),
  );
  const fixtureWallet = Keypair.fromSecretKey(Uint8Array.from(walletSecret));

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(fixtureWallet),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const program = anchor.workspace.wrapStablecoin as Program<WrapStablecoin>;
  const programId = program.programId;

  const seed = await seedLocalnet();
  const wrappedMint = new PublicKey(seed.wrappedMint);

  console.log(`Program         ${programId.toBase58()}`);
  console.log(`Fixture wallet  ${fixtureWallet.publicKey.toBase58()}`);
  console.log(`Vault config    ${seed.vaultConfig}`);
  const signer = Keypair.generate();
  fs.writeFileSync(SIGNER_OUT, JSON.stringify(Array.from(signer.secretKey)));
  console.log(
    `\n[signer] fresh keypair ${signer.publicKey.toBase58()} (saved to ${SIGNER_OUT})`,
  );

  // ─── Step 3: fund signer (SOL + USDC) ────────────────────────────────────
  const airdropSig = await connection.requestAirdrop(
    signer.publicKey,
    2_000_000_000,
  );
  await connection.confirmTransaction(airdropSig, "confirmed");
  console.log(`[fund] airdropped 2 SOL`);

  const signerUsdcAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    signer.publicKey,
  );
  const fixtureUsdcAta = getAssociatedTokenAddressSync(
    USDC_MINT,
    fixtureWallet.publicKey,
  );
  const USDC_AMOUNT = 100_000_000n; // 100 USDC

  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    fixtureWallet.publicKey,
    signerUsdcAta,
    signer.publicKey,
    USDC_MINT,
  );
  const transferIx = createTransferInstruction(
    fixtureUsdcAta,
    signerUsdcAta,
    fixtureWallet.publicKey,
    USDC_AMOUNT,
  );
  const { blockhash } = await connection.getLatestBlockhash();
  const { Transaction } = await import("@solana/web3.js");
  const fundTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fixtureWallet.publicKey,
  })
    .add(createAtaIx)
    .add(transferIx);
  fundTx.sign(fixtureWallet);
  const fundSig = await connection.sendRawTransaction(fundTx.serialize());
  await connection.confirmTransaction(fundSig, "confirmed");
  console.log(`[fund] transferred 100 USDC (tx ${fundSig})`);

  const signerUsdcBefore = await getAccount(connection, signerUsdcAta);
  console.log(`[fund] signer USDC balance: ${signerUsdcBefore.amount}`);

  // ─── Step 4: POST /v1/tx/issue, sign, submit ─────────────────────────────
  console.log("\n[issue] POST /v1/tx/issue…");
  const WRAP_AMOUNT = 50_000_000; // 50 USDC
  const issueRes = await postJson<{ transactionB64: string }>("/v1/tx/issue", {
    user: signer.publicKey.toBase58(),
    amount: WRAP_AMOUNT,
  });
  const issueTx = VersionedTransaction.deserialize(
    Buffer.from(issueRes.transactionB64, "base64"),
  );
  console.log(
    `[issue] got tx with ${issueTx.message.staticAccountKeys.length} accounts, signing…`,
  );
  issueTx.sign([signer]);
  const issueSig = await connection.sendRawTransaction(issueTx.serialize());
  await connection.confirmTransaction(issueSig, "confirmed");
  console.log(`[issue] ✓ confirmed: ${issueSig}`);

  const signerWrappedAta = getAssociatedTokenAddressSync(
    wrappedMint,
    signer.publicKey,
  );
  const wrappedBal = await getAccount(connection, signerWrappedAta);
  console.log(`[issue] signer wStable balance: ${wrappedBal.amount}`);
  if (wrappedBal.amount !== BigInt(WRAP_AMOUNT)) {
    throw new Error(
      `issue amount mismatch: got ${wrappedBal.amount}, expected ${WRAP_AMOUNT}`,
    );
  }

  // ─── Step 5: POST /v1/tx/redeem, sign, submit ────────────────────────────
  console.log("\n[redeem] POST /v1/tx/redeem…");
  const REDEEM_AMOUNT = 20_000_000; // 20 wStable
  const redeemRes = await postJson<{ transactionB64: string }>(
    "/v1/tx/redeem",
    {
      user: signer.publicKey.toBase58(),
      amount: REDEEM_AMOUNT,
    },
  );
  const redeemTx = VersionedTransaction.deserialize(
    Buffer.from(redeemRes.transactionB64, "base64"),
  );
  redeemTx.sign([signer]);
  const redeemSig = await connection.sendRawTransaction(redeemTx.serialize());
  await connection.confirmTransaction(redeemSig, "confirmed");
  console.log(`[redeem] ✓ confirmed: ${redeemSig}`);

  const wrappedAfter = await getAccount(connection, signerWrappedAta);
  const usdcAfter = await getAccount(connection, signerUsdcAta);
  console.log(`[redeem] signer wStable: ${wrappedAfter.amount}`);
  console.log(`[redeem] signer USDC:    ${usdcAfter.amount}`);

  const expectedWrapped = BigInt(WRAP_AMOUNT - REDEEM_AMOUNT);
  const expectedUsdc = signerUsdcBefore.amount - BigInt(WRAP_AMOUNT) + BigInt(REDEEM_AMOUNT);
  if (wrappedAfter.amount !== expectedWrapped) {
    throw new Error(
      `redeem wrapped mismatch: got ${wrappedAfter.amount}, expected ${expectedWrapped}`,
    );
  }
  if (usdcAfter.amount !== expectedUsdc) {
    throw new Error(
      `redeem USDC mismatch: got ${usdcAfter.amount}, expected ${expectedUsdc}`,
    );
  }

  console.log("\n✓ backend smoke test passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
