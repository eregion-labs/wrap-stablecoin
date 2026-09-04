import { Connection, PublicKey } from "@solana/web3.js";

const SPL_TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

function amountFromParsed(info: { tokenAmount?: { amount?: string } }): number {
  const raw = info.tokenAmount?.amount;
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function balancesForProgram(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
  wanted: Set<string>,
  out: Map<string, number>,
): Promise<void> {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { programId });
  for (const { account } of accounts.value) {
    const info = account.data.parsed.info as { mint: string; tokenAmount?: { amount?: string } };
    if (!wanted.has(info.mint)) continue;
    out.set(info.mint, (out.get(info.mint) ?? 0) + amountFromParsed(info));
  }
}

/**
 * SPL + Token-2022 balances for `owner`, limited to `mints`.
 * One RPC per token program (not per mint) so public endpoints are less likely to 429.
 */
export async function fetchWalletBalances(
  connection: Connection,
  owner: PublicKey,
  mints: PublicKey[],
): Promise<Map<string, number>> {
  const wanted = new Set(mints.map((m) => m.toBase58()));
  const out = new Map<string, number>();
  for (const mint of wanted) out.set(mint, 0);
  await Promise.all([
    balancesForProgram(connection, owner, SPL_TOKEN_PROGRAM, wanted, out),
    balancesForProgram(connection, owner, TOKEN_2022_PROGRAM, wanted, out),
  ]);
  return out;
}
