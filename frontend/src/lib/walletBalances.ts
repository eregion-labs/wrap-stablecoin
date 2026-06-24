import { Connection, PublicKey } from "@solana/web3.js";

/** SPL token balance for `owner` + `mint`, or 0 if no ATA exists. */
export async function fetchMintBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<number> {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  if (accounts.value.length === 0) return 0;
  const info = accounts.value[0].account.data.parsed.info as { tokenAmount: { amount: string } };
  return Number(info.tokenAmount.amount);
}

export async function fetchWalletBalances(
  connection: Connection,
  owner: PublicKey,
  mints: PublicKey[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  await Promise.all(
    mints.map(async (mint) => {
      const amount = await fetchMintBalance(connection, owner, mint);
      out.set(mint.toBase58(), amount);
    }),
  );
  return out;
}
