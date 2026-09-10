/**
 * Localnet-only bootstrap: fund the fixture wallets and mint the dummy tokens,
 * then hand the vault itself to `cli init`. Invoked by `anchor run local` once
 * the test-validator is up.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { init } from "../cli/commands/init";
import { syncEnv } from "../cli/commands/sync-env";
import { Deployment, writeDeployment } from "../cli/deployments";
import { deployerWalletPath, loadKeypair, rpcUrl, walletPath } from "../cli/network";
import {
  bootstrapDummyMints,
  CCC_MINT,
  fundLocalnetWallets,
  LOCAL_ADMIN_DUMMY_SUPPLY,
  LOCAL_SOL_TARGET,
  TTT_MINT,
} from "../tests/dummy_tokens";

/** Cloned from mainnet into the validator — see Anchor.toml [[test.validator.account]]. */
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_RESERVE = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");

export async function seedLocalnet(): Promise<Deployment> {
  const authority = loadKeypair(walletPath("localnet"));
  const payer = loadKeypair(deployerWalletPath("localnet"));
  const connection = new Connection(rpcUrl("localnet"), "confirmed");

  console.log(`[seed] fund admin + payer to ${LOCAL_SOL_TARGET / 1e9} SOL each…`);
  await fundLocalnetWallets(
    connection,
    [authority.publicKey, payer.publicKey],
    LOCAL_SOL_TARGET,
  );
  console.log(`[seed]   admin ${authority.publicKey.toBase58()}`);
  console.log(`[seed]   payer ${payer.publicKey.toBase58()}`);

  console.log("[seed] bootstrap CCC/TTT dummy mints (100M each to admin)…");
  await bootstrapDummyMints(connection, authority, LOCAL_ADMIN_DUMMY_SUPPLY);

  const deployment = await init({
    network: "localnet",
    decimalsMint: USDC_MINT.toBase58(),
    reserve: USDC_RESERVE.toBase58(),
    dryRun: false,
  });

  return writeDeployment({
    ...deployment,
    dummyMints: { CCC: CCC_MINT.toBase58(), TTT: TTT_MINT.toBase58() },
  });
}

async function main(): Promise<void> {
  syncEnv(await seedLocalnet());

  console.log("");
  console.log("[seed] mint metadata is mainnet-only — run `pnpm cli metadata initialize` there");
  console.log(`Validator RPC:  ${rpcUrl("localnet")}  (pid file: .localnet/validator.pid)`);
  console.log("Stop validator:   anchor run stop-local");
  console.log("✓ seed_localnet complete");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
