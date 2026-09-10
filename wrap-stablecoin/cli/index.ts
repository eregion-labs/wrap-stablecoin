#!/usr/bin/env node
import { parseArgs } from "node:util";
import { deploy } from "./commands/deploy";
import { init } from "./commands/init";
import {
  metadataInitialize,
  metadataRevokeAuthority,
  metadataShow,
  metadataUpdateUri,
  metadataVerify,
} from "./commands/metadata";
import { syncEnvCommand } from "./commands/sync-env";
import { brandingPath } from "./context";
import { Network, NETWORKS, parseNetwork } from "./network";

const OPTIONS = {
  network: { type: "string" },
  "decimals-mint": { type: "string" },
  asset: { type: "string" },
  reserve: { type: "string" },
  "backend-url": { type: "string" },
  from: { type: "string" },
  full: { type: "boolean", default: false },
  "dry-run": { type: "boolean", default: false },
  confirm: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
} as const;

/** Nothing touches mainnet without saying so on the command line. */
function guardMainnet(network: Network, dryRun: boolean, confirm: boolean): void {
  if (network === "mainnet" && !dryRun && !confirm) {
    throw new Error("mainnet writes require --confirm (or preview with --dry-run)");
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: OPTIONS,
    allowPositionals: true,
  });

  const [group, sub] = positionals;
  if (values.help || !group) {
    printHelp();
    return;
  }

  const network = () => parseNetwork(values.network);
  const dryRun = values["dry-run"];
  const write = (net: Network) => guardMainnet(net, dryRun, values.confirm);

  switch (group) {
    case "deploy": {
      const net = network();
      write(net);
      await deploy({ network: net, dryRun });
      return;
    }
    case "init": {
      const net = network();
      write(net);
      await init({
        network: net,
        decimalsMint: values["decimals-mint"],
        asset: values.asset,
        reserve: values.reserve,
        backendUrl: values["backend-url"],
        dryRun,
      });
      console.log(`Next: pnpm cli sync-env --network ${net}`);
      return;
    }
    case "sync-env": {
      const net = network();
      write(net);
      syncEnvCommand(net, dryRun);
      return;
    }
    case "metadata":
      await metadata(sub, network(), values, positionals.slice(2));
      return;
    default:
      throw new Error(`unknown command: ${group}`);
  }
}

async function metadata(
  sub: string | undefined,
  network: Network,
  values: { from?: string; full: boolean; "dry-run": boolean; confirm: boolean },
  rest: string[],
): Promise<void> {
  const dryRun = values["dry-run"];
  const write = () => guardMainnet(network, dryRun, values.confirm);
  switch (sub) {
    case "initialize":
      write();
      await metadataInitialize(network, dryRun, values.from);
      return;
    case "show":
      await metadataShow(network);
      return;
    case "verify":
      await metadataVerify(network, values.from, values.full);
      return;
    case "update-uri": {
      write();
      const uri = rest[0];
      if (!uri) throw new Error("usage: metadata update-uri <uri> --network <network>");
      await metadataUpdateUri(network, dryRun, uri);
      return;
    }
    case "revoke-authority":
      write();
      await metadataRevokeAuthority(network, dryRun);
      return;
    default:
      throw new Error(`unknown metadata subcommand: ${sub ?? "(none)"}`);
  }
}

function printHelp(): void {
  console.log(`Usage: pnpm cli <command> --network <${NETWORKS.join("|")}>

Commands:
  deploy                          anchor build, then deploy or upgrade on the cluster
  init --decimals-mint <mint>     initialize -> add_asset -> enable_klend (idempotent)
       [--asset <mint>]           collateral to register (default: --decimals-mint)
       [--reserve <pubkey>]       KLend reserve to enable Kamino for that collateral
       [--backend-url <url>]      recorded in the deploy artifact (default 127.0.0.1:8080)
  sync-env                        deployments/<network>.json -> backend/.env, .env.local
  metadata initialize [--from ${brandingPath()}]
  metadata show
  metadata verify [--from <path>] [--full]
  metadata update-uri <uri>
  metadata revoke-authority

Flags:
  --dry-run    print what would run, send nothing
  --confirm    required for any mainnet write

First deploy on a fresh cluster:
  pnpm cli deploy   --network devnet
  pnpm cli init     --network devnet --decimals-mint <usdc> --reserve <klend-reserve>
  pnpm cli sync-env --network devnet
  pnpm cli metadata initialize --network devnet
`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  // Program logs are the only readable part of a failed instruction.
  if (Array.isArray(e?.logs)) console.error(e.logs.join("\n"));
  process.exit(1);
});
