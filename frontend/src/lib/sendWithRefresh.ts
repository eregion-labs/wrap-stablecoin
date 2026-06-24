import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";

type SignTransaction = NonNullable<WalletAdapterProps["signTransaction"]>;

/**
 * Matches the error shapes both `sendTransaction` and RPC `sendRawTransaction`
 * emit when the backend-stamped blockhash has fallen off the validator's
 * recent-blockhash ring (TX takes ~2 min to expire on mainnet). We recognize
 * these because Solana RPC never surfaces a dedicated error code for it in
 * the preflight error body that wallets forward to the app.
 */
const EXPIRED_PATTERNS = [
  "blockhash not found",
  "blockhashnotfound",
  "block height exceeded",
  "transaction was not confirmed",
];

export function isBlockhashExpiredError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message?.toLowerCase() ?? "";
  return EXPIRED_PATTERNS.some((p) => msg.includes(p));
}

function formatSimulationError(err: unknown, logs?: string[] | null): string {
  const tail = logs?.length ? logs.slice(-8).join("\n") : "";
  return `Transaction simulation failed: ${JSON.stringify(err)}${tail ? `\n${tail}` : ""}`;
}

export type BuildTx = () => Promise<VersionedTransaction>;

export interface SendWithRefreshOptions {
  connection: Connection;
  signTransaction: SignTransaction;
  buildTx: BuildTx;
  /**
   * Invoked when the first attempt fails with an expired blockhash and we
   * are about to request a fresh transaction. Lets the caller surface the
   * "please re-sign" prompt that wallets won't show on their own.
   */
  onBlockhashExpired?: () => void;
}

/**
 * Sign via the wallet, then broadcast on the app's RPC connection.
 *
 * Wallets that implement Wallet Standard `signAndSendTransaction` route sends
 * through the extension's cluster RPC (e.g. Phantom on Devnet) even when the
 * dapp points at localnet — which surfaces as `WalletSendTransactionError:
 * Unexpected error`. Signing locally and calling `sendRawTransaction` keeps
 * simulation and submission on the same endpoint the backend uses.
 */
async function signAndSendOnce(
  connection: Connection,
  signTransaction: SignTransaction,
  tx: VersionedTransaction,
): Promise<string> {
  const preSim = await connection.simulateTransaction(tx, { sigVerify: false });
  if (preSim.value.err) {
    throw new Error(formatSimulationError(preSim.value.err, preSim.value.logs));
  }

  const signed = await signTransaction(tx);
  return connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    preflightCommitment: connection.commitment ?? "confirmed",
  });
}

/**
 * Send a backend-built transaction, transparently rebuilding and re-prompting
 * for signature once if the blockhash has expired. One retry only — repeated
 * expiries usually mean the wallet rejected, the RPC is stalled, or the user
 * walked away, and auto-retrying past that point just burns signatures.
 */
export async function sendWithBlockhashRefresh({
  connection,
  signTransaction,
  buildTx,
  onBlockhashExpired,
}: SendWithRefreshOptions): Promise<string> {
  const tx = await buildTx();
  try {
    return await signAndSendOnce(connection, signTransaction, tx);
  } catch (err) {
    if (!isBlockhashExpiredError(err)) throw err;
    onBlockhashExpired?.();
    const freshTx = await buildTx();
    return await signAndSendOnce(connection, signTransaction, freshTx);
  }
}
