import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { WrapStablecoin } from "../idl/wrap_stablecoin";
import { brandingPath, loadBranding, metadataPda, TOKEN_METADATA_PROGRAM_ID } from "./branding";
import { Network, NetworkContext, readIdl, resolveNetwork } from "./network";
import { vaultPdas, VaultPdas } from "./pdas";

export type CliContext = NetworkContext &
  VaultPdas & {
    connection: Connection;
    program: Program<WrapStablecoin>;
  };

export function loadCliContext(network: Network): CliContext {
  const net = resolveNetwork(network);
  const connection = new Connection(net.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(net.authority),
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  anchor.setProvider(provider);

  // idl.address is declare_id!, which is where net.programId comes from too.
  const program = new anchor.Program(readIdl() as anchor.Idl, provider) as Program<WrapStablecoin>;

  return {
    ...net,
    ...vaultPdas(net.programId, net.authority.publicKey),
    connection,
    program,
  };
}

export function describeContext(ctx: CliContext): string {
  return [
    `network:        ${ctx.network}`,
    `rpc:            ${ctx.rpcUrl}`,
    `wallet:         ${ctx.walletPath}`,
    `authority:      ${ctx.authority.publicKey.toBase58()}`,
    `programId:      ${ctx.programId.toBase58()}`,
    `vaultConfig:    ${ctx.vaultConfig.toBase58()}`,
    `vaultAuthority: ${ctx.vaultAuthority.toBase58()}`,
    `wrappedMint:    ${ctx.wrappedMint.toBase58()}`,
  ].join("\n  ");
}

export { brandingPath, loadBranding, metadataPda, TOKEN_METADATA_PROGRAM_ID };
