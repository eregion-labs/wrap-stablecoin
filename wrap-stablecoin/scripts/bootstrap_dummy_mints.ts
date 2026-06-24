/**
 * Idempotent: create CCC / TTT SPL mints from dummy-tokens keypairs and fund payer.
 */

import * as fs from "node:fs";
import { Connection, Keypair } from "@solana/web3.js";
import {
  bootstrapDummyMints,
  CCC_MINT,
  fundLocalnetWallets,
  LOCAL_ADMIN_DUMMY_SUPPLY,
  LOCAL_SOL_TARGET,
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

const PAYER_WALLET_PATH =
  process.env.PAYER_WALLET_PATH ||
  ".secrets/depxPDoQBS9JXgwVumiJeuaaSU9b8FaCRwEVTaGD1v9.json";

async function main() {
  const admin = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_WALLET_PATH, "utf8"))),
  );
  const connection = new Connection(RPC_URL, "confirmed");

  console.log(`Funding admin + payer to ${LOCAL_SOL_TARGET / 1e9} SOL each…`);
  await fundLocalnetWallets(
    connection,
    [admin.publicKey, payer.publicKey],
    LOCAL_SOL_TARGET,
  );

  await bootstrapDummyMints(connection, admin, LOCAL_ADMIN_DUMMY_SUPPLY);

  console.log("Dummy mints ready (100M each to admin):");
  console.log(`  CCC ${CCC_MINT.toBase58()}`);
  console.log(`  TTT ${TTT_MINT.toBase58()}`);
  console.log(`  Admin ${admin.publicKey.toBase58()}`);
  console.log(`  Payer ${payer.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
