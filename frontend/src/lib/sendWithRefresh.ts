import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { WalletAdapterProps } from "@solana/wallet-adapter-base";

type SendTransaction = WalletAdapterProps["sendTransaction"];

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

export type BuildTx = () => Promise<VersionedTransaction>;

export interface SendWithRefreshOptions {
  connection: Connection;
  sendTransaction: SendTransaction;
  buildTx: BuildTx;
  /**
   * Invoked when the first attempt fails with an expired blockhash and we
   * are about to request a fresh transaction. Lets the caller surface the
   * "please re-sign" prompt that wallets won't show on their own.
   */
  onBlockhashExpired?: () => void;
}

/**
 * Send a backend-built transaction, transparently rebuilding and re-prompting
 * for signature once if the blockhash has expired. One retry only — repeated
 * expiries usually mean the wallet rejected, the RPC is stalled, or the user
 * walked away, and auto-retrying past that point just burns signatures.
 */
export async function sendWithBlockhashRefresh({
  connection,
  sendTransaction,
  buildTx,
  onBlockhashExpired,
}: SendWithRefreshOptions): Promise<string> {
  const tx = await buildTx();
  try {
    return await sendTransaction(tx, connection);
  } catch (err) {
    if (!isBlockhashExpiredError(err)) throw err;
    onBlockhashExpired?.();
    const freshTx = await buildTx();
    return await sendTransaction(freshTx, connection);
  }
}
