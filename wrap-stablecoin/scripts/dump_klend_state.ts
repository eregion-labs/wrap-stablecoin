/**
 * Pull USDC-reserve state from Kamino Main Market (mainnet-beta) and write each
 * account as a solana-test-validator-compatible JSON fixture. The validator started
 * by `anchor test` loads these via `[[test.validator.account]]` so the tree is
 * reproducible offline — no mainnet RPC dependency at test time.
 *
 * Run:
 *   yarn ts-node scripts/dump_klend_state.ts
 *
 * Output: fixtures/klend/*.json (one per account) + fixtures/klend/manifest.toml
 *
 * Env overrides:
 *   RPC_URL    mainnet RPC (default: public mainnet-beta)
 *   MARKET     lending market (default: Kamino Main Market)
 *   MINT       reserve liquidity mint (default: USDC)
 *   OUT_DIR    output directory (default: fixtures/klend)
 */

import {
  Address,
  address,
  createSolanaRpc,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { KaminoMarket } from "@kamino-finance/klend-sdk";
import * as fs from "node:fs";
import * as path from "node:path";

const RPC_URL = process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com";
const MARKET: Address = address(
  process.env.MARKET ?? "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
);
const MINT: Address = address(
  process.env.MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const OUT_DIR = process.env.OUT_DIR ?? "fixtures/klend";
const SLOT_DURATION_MS = 450;
const DEFAULT_ADDRESS = "11111111111111111111111111111111" as Address;

interface FixtureEntry {
  label: string;
  filename: string;
  address: Address;
}

async function dumpAccount(
  rpc: Rpc<SolanaRpcApi>,
  addr: Address,
  outPath: string,
): Promise<void> {
  const resp = await rpc
    .getAccountInfo(addr, { encoding: "base64" })
    .send();
  if (!resp.value) {
    throw new Error(`account ${addr} not found on ${RPC_URL}`);
  }
  const acc = resp.value;
  const [dataB64, encoding] = acc.data as [string, string];
  if (encoding !== "base64") {
    throw new Error(`unexpected encoding ${encoding} for ${addr}`);
  }

  // rentEpoch on live accounts is u64::MAX (18446744073709551615) which JS Number
  // can't represent. Build the JSON by hand so bigints land as unquoted integer
  // literals that serde_json parses into u64 cleanly.
  const space = acc.space ? BigInt(acc.space) : BigInt(Buffer.from(dataB64, "base64").length);
  const body = `{
  "pubkey": "${addr}",
  "account": {
    "lamports": ${acc.lamports},
    "data": [
      "${dataB64}",
      "base64"
    ],
    "owner": "${acc.owner}",
    "executable": ${acc.executable},
    "rentEpoch": ${acc.rentEpoch},
    "space": ${space}
  }
}
`;
  fs.writeFileSync(outPath, body);
}

async function main() {
  const rpc = createSolanaRpc(RPC_URL);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Snapshot the source slot so the test validator can --warp-to-slot to match.
  // Cloned accounts' `last_update.slot` and oracle timestamps are frozen at this
  // slot; starting the test validator close to it keeps KLend's staleness checks
  // from instantly rejecting the reserve.
  const slot = await rpc.getSlot().send();
  fs.writeFileSync(path.join(OUT_DIR, "slot.txt"), `${slot}\n`);

  console.error(`Loading KLend market ${MARKET} from ${RPC_URL} (slot ${slot}) …`);
  const market = await KaminoMarket.load(rpc, MARKET, SLOT_DURATION_MS);
  if (!market) {
    throw new Error(`failed to load market ${MARKET}`);
  }

  const reserve = market.getReserveByMint(MINT);
  if (!reserve) {
    throw new Error(`no reserve for mint ${MINT}`);
  }

  const s = reserve.state;
  const entries: FixtureEntry[] = [
    { label: "lending_market", filename: "lending_market.json", address: MARKET },
    { label: "reserve", filename: "reserve.json", address: reserve.address },
    {
      label: "reserve_liquidity_supply",
      filename: "reserve_liquidity_supply.json",
      address: s.liquidity.supplyVault,
    },
    {
      label: "reserve_collateral_mint",
      filename: "reserve_collateral_mint.json",
      address: s.collateral.mintPubkey,
    },
    {
      label: "reserve_fee_vault",
      filename: "reserve_fee_vault.json",
      address: s.liquidity.feeVault,
    },
    {
      label: "liquidity_mint_usdc",
      filename: "liquidity_mint_usdc.json",
      address: MINT,
    },
  ];

  const oracleCandidates: Array<[string, Address]> = [
    ["pyth_price", s.config.tokenInfo.pythConfiguration.price],
    [
      "switchboard_price",
      s.config.tokenInfo.switchboardConfiguration.priceAggregator,
    ],
    [
      "switchboard_twap",
      s.config.tokenInfo.switchboardConfiguration.twapAggregator,
    ],
    ["scope_prices", s.config.tokenInfo.scopeConfiguration.priceFeed],
  ];
  for (const [label, addr] of oracleCandidates) {
    if (addr !== DEFAULT_ADDRESS) {
      entries.push({ label, filename: `${label}.json`, address: addr });
    }
  }

  for (const e of entries) {
    const p = path.join(OUT_DIR, e.filename);
    console.error(`  dumping ${e.label.padEnd(26)} ${e.address}  →  ${p}`);
    await dumpAccount(rpc, e.address, p);
  }

  // Write a manifest.toml block the user can paste into Anchor.toml.
  const tomlLines: string[] = [
    `# Generated by scripts/dump_klend_state.ts on ${new Date().toISOString()}`,
    `# Source: ${RPC_URL}`,
    `# Market: ${MARKET}`,
    `# Mint:   ${MINT}`,
    `# Reserve: ${reserve.address}`,
    ``,
  ];
  for (const e of entries) {
    tomlLines.push(`# ${e.label}`);
    tomlLines.push(`[[test.validator.account]]`);
    tomlLines.push(`address = "${e.address}"`);
    tomlLines.push(`filename = "${path.join(OUT_DIR, e.filename)}"`);
    tomlLines.push(``);
  }
  const manifestPath = path.join(OUT_DIR, "manifest.toml");
  fs.writeFileSync(manifestPath, tomlLines.join("\n"));

  console.error(`\nOK. ${entries.length} accounts dumped.`);
  console.error(`Manifest: ${manifestPath}`);
  console.error(`Reserve: ${reserve.address}`);
  console.error(
    `Scope prices: ${s.config.tokenInfo.scopeConfiguration.priceFeed}`,
  );
  console.error(
    `\nPaste the contents of ${manifestPath} into Anchor.toml after [[test.genesis]].`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
