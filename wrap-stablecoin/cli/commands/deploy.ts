/**
 * Build and publish the program on one cluster. Anchor owns the deploy itself;
 * this only picks the cluster, decides deploy vs upgrade, and reports the id.
 */

import { spawnSync } from "node:child_process";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  assertTrackedIdlMatchesBuild,
  deployerWalletPath,
  deployKeypairId,
  loadKeypair,
  Network,
  PACKAGE_ROOT,
  programId,
  rpcUrl,
} from "../network";

const PROGRAM_NAME = "wrap_stablecoin";
const PROGRAM_SO = `target/deploy/${PROGRAM_NAME}.so`;

export type DeployOptions = {
  network: Network;
  dryRun: boolean;
};

function run(command: string, args: string[], dryRun: boolean): void {
  const printable = [command, ...args].join(" ");
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return;
  }
  console.log(`$ ${printable}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: PACKAGE_ROOT });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

/**
 * A first deploy publishes under the deploy keypair, while every PDA derives from
 * declare_id!. `anchor build` mints a fresh keypair whenever that file is absent,
 * so a mismatch here means the real one is gone — stop before spending SOL on an
 * address nothing else uses. Upgrades never read this file.
 */
function assertDeployKeypairMatches(program: PublicKey): void {
  const keypairId = deployKeypairId();
  if (!keypairId) {
    throw new Error(`missing deploy keypair for ${PROGRAM_NAME} — run anchor build`);
  }
  if (!keypairId.equals(program)) {
    throw new Error(
      `deploy keypair is ${keypairId.toBase58()} but declare_id! is ${program.toBase58()}.\n` +
        `Restore the keypair for ${program.toBase58()} to deploy it, or change declare_id! ` +
        `to publish a new program at ${keypairId.toBase58()}.`,
    );
  }
}

const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
/** Program { enum: u32, programdata: Pubkey } */
const PROGRAMDATA_OFFSET = 4;
/** ProgramData { enum: u32, slot: u64, authority: Option<Pubkey> } */
const AUTHORITY_TAG_OFFSET = 12;

/** `undefined` when the program is not deployed, `null` when it is immutable. */
async function upgradeAuthority(
  connection: Connection,
  program: PublicKey,
): Promise<PublicKey | null | undefined> {
  const account = await connection.getAccountInfo(program);
  if (!account?.executable) return undefined;
  if (!account.owner.equals(BPF_LOADER_UPGRADEABLE)) return null;

  const programData = new PublicKey(
    account.data.subarray(PROGRAMDATA_OFFSET, PROGRAMDATA_OFFSET + 32),
  );
  const data = (await connection.getAccountInfo(programData))?.data;
  if (!data || data.readUInt8(AUTHORITY_TAG_OFFSET) !== 1) return null;
  return new PublicKey(data.subarray(AUTHORITY_TAG_OFFSET + 1, AUTHORITY_TAG_OFFSET + 33));
}

/** An upgrade signed by the wrong key fails only after a full build and buffer write. */
function assertCanUpgrade(
  authority: PublicKey | null,
  deployer: PublicKey,
  program: PublicKey,
  network: Network,
): void {
  if (!authority) {
    throw new Error(`${program.toBase58()} is immutable — it can no longer be upgraded`);
  }
  if (!authority.equals(deployer)) {
    throw new Error(
      `upgrade authority for ${program.toBase58()} is ${authority.toBase58()}, ` +
        `but the deployer wallet is ${deployer.toBase58()}.\n` +
        `Point DEPLOYER_WALLET_${network.toUpperCase()} at the authority's keypair.`,
    );
  }
}

export async function deploy(opts: DeployOptions): Promise<void> {
  const rpc = rpcUrl(opts.network);
  const deployer = deployerWalletPath(opts.network);
  console.log(`network:  ${opts.network}`);
  console.log(`rpc:      ${rpc}`);
  console.log(`deployer: ${deployer}`);

  run("anchor", ["build"], opts.dryRun);
  if (!opts.dryRun) assertTrackedIdlMatchesBuild();

  let program: PublicKey;
  try {
    program = programId();
  } catch (e) {
    if (opts.dryRun) {
      console.log("[dry-run] program id reads from the tracked IDL (idl/wrap_stablecoin.json)");
      return;
    }
    throw e;
  }
  console.log(`program:  ${program.toBase58()}`);

  const provider = ["--provider.cluster", rpc, "--provider.wallet", deployer];
  const authority = await upgradeAuthority(new Connection(rpc, "confirmed"), program);
  if (authority !== undefined) {
    // Upgrading authorises off the program's upgrade authority, not the keypair.
    assertCanUpgrade(authority, loadKeypair(deployer).publicKey, program, opts.network);
    run("anchor", ["upgrade", PROGRAM_SO, "--program-id", program.toBase58(), ...provider], opts.dryRun);
  } else {
    assertDeployKeypairMatches(program);
    run("anchor", ["deploy", "--program-name", PROGRAM_NAME, ...provider], opts.dryRun);
  }

  console.log("");
  console.log(`Next: pnpm cli init --network ${opts.network} --decimals-mint <mint>`);
}
