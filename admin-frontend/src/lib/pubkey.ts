import { PublicKey } from "@solana/web3.js";
import { actionErr, actionOk, type ActionResult } from "@/stores/types";

/** Trim and validate a base58 Solana pubkey. */
export function requirePubkey(raw: string, label: string): ActionResult<string> {
  const pubkey = raw.trim();
  if (!pubkey) {
    return actionErr(`${label} pubkey is required`);
  }
  try {
    const key = new PublicKey(pubkey);
    return actionOk(key.toBase58());
  } catch {
    return actionErr(`invalid ${label} pubkey`);
  }
}
