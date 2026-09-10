/**
 * Idempotent: create CCC / TTT SPL mints from dummy-tokens keypairs and fund payer.
 */

import { Connection } from "@solana/web3.js";
import { deployerWalletPath, loadKeypair, rpcUrl, walletPath } from "../cli/network";
import {
  bootstrapDummyMints,
  CCC_MINT,
  fundLocalnetWallets,
  LOCAL_ADMIN_DUMMY_SUPPLY,
  LOCAL_SOL_TARGET,
  TTT_MINT,
} from "../tests/dummy_tokens";

async function main() {
  const admin = loadKeypair(walletPath("localnet"));
  const payer = loadKeypair(deployerWalletPath("localnet"));
  const connection = new Connection(rpcUrl("localnet"), "confirmed");

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
