/**
 * Idempotent: create CCC / TTT SPL mints from dummy-tokens keypairs and fund payer.
 */

import * as fs from "node:fs";
import { Connection, Keypair } from "@solana/web3.js";
import {
  bootstrapDummyMints,
  CCC_MINT,
  LOCAL_ADMIN_DUMMY_SUPPLY,
  TTT_MINT,
} from "../tests/dummy_tokens";

const RPC_URL =
  process.env.ANCHOR_PROVIDER_URL ||
  process.env.RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "http://127.0.0.1:8901";

const WALLET_PATH =
  process.env.ANCHOR_WALLET ||
  process.env.ANCHOR_WALLET_PATH ||
  ".secrets/admwu2g9WV2kdwTzjasLXTy7tWq3W15BrP4PE7UZJ5x.json";

async function main() {
  const walletSecret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletSecret));
  const connection = new Connection(RPC_URL, "confirmed");

  await bootstrapDummyMints(connection, payer, LOCAL_ADMIN_DUMMY_SUPPLY);

  console.log("Dummy mints ready (100M each to admin):");
  console.log(`  CCC ${CCC_MINT.toBase58()}`);
  console.log(`  TTT ${TTT_MINT.toBase58()}`);
  console.log(`  Payer ${payer.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
