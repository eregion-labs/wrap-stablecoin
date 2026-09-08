import { Connection, PublicKey } from "@solana/web3.js";
import { requirePubkey } from "@/lib/pubkey";
import { parseTokenAmount } from "@/lib/tokenAmount";

const SPL_TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export type WithdrawReviewReason =
  | "Enter an amount."
  | "Exceeds available balance."
  | "Enter a destination."
  | "Enter a valid wallet address."
  | "Use the wallet address, not a token account."
  | "This wallet cannot receive this token.";

export type DestinationProbe = {
  isTokenAccount: boolean;
  ataFrozen: boolean;
};

function associatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM,
  );
  return ata;
}

function accountFrozen(data: Buffer): boolean {
  // SPL token account state enum at offset 108: 2 = Frozen
  return data.length >= 109 && data[108] === 2;
}

/** Probe pasted destination: token-account vs wallet, and whether its ATA is frozen. */
export async function probeWithdrawDestination(
  connection: Connection,
  destination: string,
  mint: string,
): Promise<DestinationProbe> {
  const empty = { isTokenAccount: false, ataFrozen: false };
  const parsed = requirePubkey(destination, "destination");
  if (!parsed.ok) return empty;
  let destPk: PublicKey;
  let mintPk: PublicKey;
  try {
    destPk = new PublicKey(parsed.data);
    mintPk = new PublicKey(mint);
  } catch {
    return empty;
  }

  const info = await connection.getAccountInfo(destPk);
  if (info) {
    const owner = info.owner;
    if (owner.equals(SPL_TOKEN_PROGRAM) || owner.equals(TOKEN_2022_PROGRAM)) {
      return { isTokenAccount: true, ataFrozen: false };
    }
  }

  // Prefer mint's token program when known; otherwise try both ATAs.
  let mintOwner: PublicKey = SPL_TOKEN_PROGRAM;
  try {
    const mintInfo = await connection.getAccountInfo(mintPk);
    if (mintInfo) mintOwner = mintInfo.owner;
  } catch {
    /* keep SPL default */
  }

  const programs =
    mintOwner.equals(TOKEN_2022_PROGRAM)
      ? [TOKEN_2022_PROGRAM]
      : mintOwner.equals(SPL_TOKEN_PROGRAM)
        ? [SPL_TOKEN_PROGRAM]
        : [SPL_TOKEN_PROGRAM, TOKEN_2022_PROGRAM];

  for (const program of programs) {
    const ata = associatedTokenAddress(destPk, mintPk, program);
    const ataInfo = await connection.getAccountInfo(ata);
    if (ataInfo && accountFrozen(Buffer.from(ataInfo.data))) {
      return { isTokenAccount: false, ataFrozen: true };
    }
  }
  return empty;
}

/** Sync disable reason for Review (RPC probe results passed in). */
export function withdrawReviewReason(opts: {
  amountRaw: string;
  decimals: number;
  treasuryBalance: number;
  destination: string;
  probe?: DestinationProbe | null;
}): WithdrawReviewReason | null {
  const atoms = parseTokenAmount(opts.amountRaw, opts.decimals);
  if (atoms == null) return "Enter an amount.";
  if (atoms > opts.treasuryBalance) return "Exceeds available balance.";

  const dest = opts.destination.trim();
  if (!dest) return "Enter a destination.";
  const pk = requirePubkey(dest, "destination");
  if (!pk.ok) return "Enter a valid wallet address.";

  if (opts.probe?.isTokenAccount) return "Use the wallet address, not a token account.";
  if (opts.probe?.ataFrozen) return "This wallet cannot receive this token.";
  return null;
}

/** Known USD-pegged display symbols (1:1, no oracle). */
export function isUsdPeggedSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s === "USDC" || s === "USDT" || s.startsWith("TUSD");
}

export function formatUsdApprox(atoms: number, decimals: number): string {
  const value = atoms / 10 ** decimals;
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatReceiveAmount(
  atoms: number,
  decimals: number,
  symbol: string,
): string {
  const value = atoms / 10 ** decimals;
  if (isUsdPeggedSymbol(symbol)) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(Math.max(decimals, 0), 8),
  });
}
