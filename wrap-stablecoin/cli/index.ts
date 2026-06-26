#!/usr/bin/env node
import {
  metadataInitialize,
  metadataRevokeAuthority,
  metadataShow,
  metadataUpdateUri,
  metadataVerify,
} from "./commands/metadata";
import { brandingPath } from "./context";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    return;
  }

  const [group, sub, ...rest] = args;
  if (group !== "metadata") {
    throw new Error(`unknown command group: ${group}`);
  }

  const fromIdx = rest.indexOf("--from");
  const from = fromIdx >= 0 ? rest[fromIdx + 1] : undefined;
  const full = rest.includes("--full");

  switch (sub) {
    case "initialize":
      await metadataInitialize(from);
      break;
    case "show":
      await metadataShow();
      break;
    case "verify":
      await metadataVerify(from, full);
      break;
    case "update-uri": {
      const uri = rest.find((a) => !a.startsWith("--"));
      if (!uri) throw new Error("usage: metadata update-uri <uri>");
      await metadataUpdateUri(uri);
      break;
    }
    case "revoke-authority":
      await metadataRevokeAuthority();
      break;
    default:
      throw new Error(`unknown metadata subcommand: ${sub ?? "(none)"}`);
  }
}

function printHelp(): void {
  console.log(`Usage: pnpm cli metadata <subcommand>

Subcommands:
  initialize [--from ${brandingPath()}]
  show
  verify [--from path] [--full]
  update-uri <uri>
  revoke-authority
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
