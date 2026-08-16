import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";

export function decodeB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Parse a Solana CLI / `solana-keygen` JSON secret-key array. */
export function parseSolanaSecretKeyJson(text: string): Uint8Array {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length < 64) {
    throw new Error("expected a Solana keypair JSON array (64 bytes)");
  }
  if (!parsed.every((n) => typeof n === "number" && n >= 0 && n <= 255)) {
    throw new Error("keypair JSON must be an array of bytes 0–255");
  }
  return Uint8Array.from(parsed);
}

export async function readKeypairFile(file: File): Promise<Uint8Array> {
  const text = await file.text();
  return parseSolanaSecretKeyJson(text);
}

/**
 * Sign a backend-built unsigned versioned tx in the browser and submit it to
 * the client-config RPC. The secret never leaves this tab.
 */
export async function signAndSendUnsignedTx(opts: {
  transactionB64: string;
  secretKey: Uint8Array;
  rpcUrl: string;
  expectedSigner: string;
}): Promise<string> {
  const keypair = Keypair.fromSecretKey(opts.secretKey);
  const signer = keypair.publicKey.toBase58();
  if (signer !== opts.expectedSigner) {
    throw new Error(
      `keypair ${signer} does not match pending destination ${opts.expectedSigner}`,
    );
  }
  const tx = VersionedTransaction.deserialize(decodeB64(opts.transactionB64));
  tx.sign([keypair]);
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  const latest = await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    { signature, ...latest },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  return signature;
}
