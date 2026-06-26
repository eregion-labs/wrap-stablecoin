import * as fs from "node:fs";
import * as path from "node:path";
import { PublicKey } from "@solana/web3.js";

export type BrandingConfig = {
  name: string;
  symbol: string;
  decimals: number;
  primaryColor: string;
  icon: string;
  website: string;
  explorer: string;
  description: string;
  coingeckoId: string | null;
  metadataUri: string;
};

const REPO_ROOT = path.resolve(__dirname, "../..");

export function brandingPath(from?: string): string {
  return from ?? path.join(REPO_ROOT, "branding", "florin.json");
}

export function loadBranding(from?: string): BrandingConfig {
  const file = brandingPath(from);
  return JSON.parse(fs.readFileSync(file, "utf8")) as BrandingConfig;
}

export const TOKEN_METADATA_PROGRAM_ID =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export function metadataPda(mint: string): [string, number] {
  const mintKey = new PublicKey(mint);
  const programId = new PublicKey(TOKEN_METADATA_PROGRAM_ID);
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), programId.toBuffer(), mintKey.toBuffer()],
    programId,
  );
  return [pda.toBase58(), bump];
}
