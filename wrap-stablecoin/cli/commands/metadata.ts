import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  loadBranding,
  loadCliContext,
  metadataPda,
  TOKEN_METADATA_PROGRAM_ID,
} from "../context";

export async function metadataInitialize(from?: string): Promise<void> {
  const branding = loadBranding(from);
  const ctx = await loadCliContext();
  const [metadata] = metadataPda(ctx.wrappedMint.toBase58());
  const metadataKey = new PublicKey(metadata);

  const existing = await ctx.connection.getAccountInfo(metadataKey);
  if (existing !== null && existing.data.length > 0) {
    console.log(`[metadata initialize] already exists at ${metadata}`);
    return;
  }

  const sig = await ctx.program.methods
    .initializeMintMetadata(branding.name, branding.symbol, branding.metadataUri)
    .accountsPartial({
      authority: ctx.authority.publicKey,
      vaultConfig: ctx.vaultConfig,
      vaultAuthority: ctx.vaultAuthority,
      wrappedMint: ctx.wrappedMint,
      metadata: metadataKey,
      tokenMetadataProgram: new PublicKey(TOKEN_METADATA_PROGRAM_ID),
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();

  console.log(`[metadata initialize] tx ${sig}`);
  console.log(`  mint: ${ctx.wrappedMint.toBase58()}`);
  console.log(`  metadata: ${metadata}`);
  console.log(`  name: ${branding.name}`);
  console.log(`  symbol: ${branding.symbol}`);
  console.log(`  uri: ${branding.metadataUri}`);
}

export async function metadataShow(): Promise<void> {
  const ctx = await loadCliContext();
  const [metadata] = metadataPda(ctx.wrappedMint.toBase58());
  const account = await ctx.connection.getAccountInfo(new PublicKey(metadata));
  if (!account) {
    console.log("Metadata account not found");
    console.log(`  wrappedMint: ${ctx.wrappedMint.toBase58()}`);
    console.log(`  metadataPda: ${metadata}`);
    return;
  }

  const parsed = parseMetadata(account.data);
  console.log(JSON.stringify({ wrappedMint: ctx.wrappedMint.toBase58(), metadata, ...parsed }, null, 2));
}

export async function metadataVerify(from?: string, full = false): Promise<void> {
  const branding = loadBranding(from);
  const ctx = await loadCliContext();
  const [metadata] = metadataPda(ctx.wrappedMint.toBase58());
  const metadataKey = new PublicKey(metadata);
  const account = await ctx.connection.getAccountInfo(metadataKey);
  if (!account) {
    throw new Error(`metadata account missing: ${metadata}`);
  }

  const parsed = parseMetadata(account.data);
  const errors: string[] = [];
  if (parsed.name !== branding.name) errors.push(`name: got "${parsed.name}", want "${branding.name}"`);
  if (parsed.symbol !== branding.symbol) errors.push(`symbol: got "${parsed.symbol}", want "${branding.symbol}"`);
  if (!parsed.uri) errors.push("uri is empty");
  if (parsed.uri !== branding.metadataUri) {
    errors.push(`uri: got "${parsed.uri}", want "${branding.metadataUri}"`);
  }
  if (!parsed.isMutable) errors.push("is_mutable is false (expected true pre-governance)");

  const mintInfo = await ctx.connection.getParsedAccountInfo(ctx.wrappedMint);
  const mintData = (mintInfo.value?.data as { parsed?: { info?: Record<string, unknown> } })?.parsed
    ?.info;
  if (mintData?.decimals !== branding.decimals) {
    errors.push(`decimals: got ${mintData?.decimals}, want ${branding.decimals}`);
  }
  if (mintData?.mintAuthority !== ctx.vaultAuthority.toBase58()) {
    errors.push(`mint authority mismatch: ${mintData?.mintAuthority}`);
  }
  if (mintData?.freezeAuthority !== null) {
    errors.push(`unexpected freeze authority: ${mintData?.freezeAuthority}`);
  }

  if (full && parsed.uri.startsWith("http")) {
    try {
      const res = await fetch(parsed.uri, { method: "HEAD" });
      if (!res.ok) errors.push(`uri HEAD failed: ${res.status}`);
    } catch (e) {
      errors.push(`uri HEAD error: ${e}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`metadata verify failed:\n- ${errors.join("\n- ")}`);
  }
  console.log("metadata verify OK");
}

export async function metadataUpdateUri(uri: string): Promise<void> {
  if (!uri) throw new Error("uri required");
  const ctx = await loadCliContext();
  const [metadata] = metadataPda(ctx.wrappedMint.toBase58());
  const ix = buildUpdateMetadataV2Ix(new PublicKey(metadata), ctx.authority.publicKey, { uri });
  const tx = new Transaction().add(ix);
  const sig = await ctx.connection.sendTransaction(tx, [ctx.authority]);
  await ctx.connection.confirmTransaction(sig, "confirmed");
  console.log(`[metadata update-uri] tx ${sig}`);
}

export async function metadataRevokeAuthority(): Promise<void> {
  const ctx = await loadCliContext();
  const [metadata] = metadataPda(ctx.wrappedMint.toBase58());
  const ix = buildUpdateMetadataV2Ix(new PublicKey(metadata), ctx.authority.publicKey, {
    isMutable: false,
  });
  const tx = new Transaction().add(ix);
  const sig = await ctx.connection.sendTransaction(tx, [ctx.authority]);
  await ctx.connection.confirmTransaction(sig, "confirmed");
  console.log(`[metadata revoke-authority] set is_mutable=false tx ${sig}`);
}

function buildUpdateMetadataV2Ix(
  metadata: PublicKey,
  updateAuthority: PublicKey,
  fields: { uri?: string; isMutable?: boolean },
): TransactionInstruction {
  const data = Buffer.alloc(1 + 1 + 1 + 4 + 200 + 1);
  let offset = 0;
  data.writeUInt8(15, offset);
  offset += 1;
  data.writeUInt8(1, offset);
  offset += 1;
  data.writeUInt8(fields.uri !== undefined ? 1 : 0, offset);
  offset += 1;
  if (fields.uri !== undefined) {
    const uriBytes = Buffer.from(fields.uri, "utf8");
    data.writeUInt32LE(uriBytes.length, offset);
    offset += 4;
    uriBytes.copy(data, offset);
    offset += uriBytes.length;
  }
  data.writeUInt8(fields.isMutable !== undefined ? 1 : 0, offset);
  offset += 1;
  if (fields.isMutable !== undefined) {
    data.writeUInt8(fields.isMutable ? 1 : 0, offset);
    offset += 1;
  }
  return new TransactionInstruction({
    programId: new PublicKey(TOKEN_METADATA_PROGRAM_ID),
    keys: [{ pubkey: metadata, isSigner: false, isWritable: true }, { pubkey: updateAuthority, isSigner: true, isWritable: false }],
    data: data.subarray(0, offset),
  });
}

function parseMetadata(data: Buffer): {
  name: string;
  symbol: string;
  uri: string;
  updateAuthority: string | null;
  isMutable: boolean;
} {
  const updateAuthorityKey = new PublicKey(data.subarray(1, 33));
  const updateAuthority = updateAuthorityKey.equals(PublicKey.default)
    ? null
    : updateAuthorityKey.toBase58();

  let offset = 1 + 32 + 32;
  const readString = (): string => {
    const len = data.readUInt32LE(offset);
    offset += 4;
    const value = data.subarray(offset, offset + len).toString("utf8").replace(/\0/g, "").trim();
    offset += len;
    return value;
  };
  const name = readString();
  const symbol = readString();
  const uri = readString();
  offset += 2;
  const hasCreators = data.readUInt8(offset) === 1;
  offset += 1;
  if (hasCreators) {
    const n = data.readUInt32LE(offset);
    offset += 4 + n * (32 + 1 + 1);
  }
  const hasCollection = data.readUInt8(offset) === 1;
  offset += 1;
  if (hasCollection) offset += 32 + 1;
  const hasUses = data.readUInt8(offset) === 1;
  offset += 1;
  if (hasUses) offset += 18;
  const isMutable = data.readUInt8(offset) === 1;
  return { name, symbol, uri, updateAuthority, isMutable };
}
