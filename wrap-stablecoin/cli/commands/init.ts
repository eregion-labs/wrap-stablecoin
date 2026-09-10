/**
 * Vault bootstrap for any cluster: initialize -> add_asset -> enable_klend.
 *
 * Every step is skipped when its account already exists, so re-running is safe
 * and registering a second collateral is just another `init --asset`.
 */

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { CliContext, describeContext, loadCliContext } from "../context";
import {
  Deployment,
  deploymentPath,
  readDeploymentIfPresent,
  relative,
  writeDeployment,
} from "../deployments";
import { readReserveFields } from "../klend";
import { Network } from "../network";
import { assetPdas } from "../pdas";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8080";

export type InitOptions = {
  network: Network;
  /** Mint whose decimals define Florin precision. Required on first init. */
  decimalsMint?: string;
  /** Collateral to register. Defaults to --decimals-mint. */
  asset?: string;
  /** KLend reserve for the collateral; omit to register without Kamino. */
  reserve?: string;
  backendUrl?: string;
  dryRun: boolean;
};

/** Collateral may be classic SPL Token or Token-2022; the program accepts either. */
async function tokenProgramOf(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const account = await connection.getAccountInfo(mint);
  if (!account) throw new Error(`mint not found: ${mint.toBase58()}`);
  if (!account.owner.equals(TOKEN_PROGRAM_ID) && !account.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error(
      `${mint.toBase58()} is not an SPL mint: owned by ${account.owner.toBase58()}`,
    );
  }
  return account.owner;
}

async function exists(connection: Connection, address: PublicKey): Promise<boolean> {
  return (await connection.getAccountInfo(address)) !== null;
}

async function initializeVault(
  ctx: CliContext,
  decimalsMint: PublicKey,
  dryRun: boolean,
): Promise<void> {
  if (await exists(ctx.connection, ctx.vaultConfig)) {
    console.log("[init] vault_config exists — skip initialize");
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] initialize (decimals from ${decimalsMint.toBase58()})`);
    return;
  }
  const sig = await ctx.program.methods
    .initialize()
    .accountsPartial({
      authority: ctx.authority.publicKey,
      decimalsMint,
      vaultConfig: ctx.vaultConfig,
      wrappedMint: ctx.wrappedMint,
      vaultAuthority: ctx.vaultAuthority,
      // Mints the Florin token itself, which the program pins to classic SPL Token.
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
  console.log(`[init] initialize tx ${sig}`);
}

async function addAsset(
  ctx: CliContext,
  asset: PublicKey,
  pdas: ReturnType<typeof assetPdas>,
  dryRun: boolean,
): Promise<void> {
  if (await exists(ctx.connection, pdas.assetConfig)) {
    console.log(`[init] asset_config exists — skip add_asset(${asset.toBase58()})`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] add_asset(${asset.toBase58()})`);
    return;
  }
  const sig = await ctx.program.methods
    .addAsset({ mintEnabled: true, redeemEnabled: true } as any)
    .accountsPartial({
      admin: ctx.authority.publicKey,
      vaultConfig: ctx.vaultConfig,
      vaultAuthority: ctx.vaultAuthority,
      underlyingMint: asset,
      assetConfig: pdas.assetConfig,
      tokenVault: pdas.tokenVault,
      treasuryVault: pdas.treasuryVault,
      tokenProgram: await tokenProgramOf(ctx.connection, asset),
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
  console.log(`[init] add_asset tx ${sig}`);
}

async function enableKlend(
  ctx: CliContext,
  asset: PublicKey,
  reserve: PublicKey,
  pdas: ReturnType<typeof assetPdas>,
  dryRun: boolean,
): Promise<{ reserve: string; lendingMarket: string }> {
  const fields = await readReserveFields(ctx.connection, reserve);
  if (!fields.liquidityMint.equals(asset)) {
    throw new Error(
      `reserve ${reserve.toBase58()} lends ${fields.liquidityMint.toBase58()}, not ${asset.toBase58()}`,
    );
  }
  const record = {
    reserve: reserve.toBase58(),
    lendingMarket: fields.lendingMarket.toBase58(),
  };

  if (await exists(ctx.connection, pdas.klendConfig)) {
    console.log("[init] klend_config exists — skip enable_klend");
    return record;
  }
  if (dryRun) {
    console.log(`[dry-run] enable_klend(reserve ${record.reserve}, market ${record.lendingMarket})`);
    return record;
  }
  const sig = await ctx.program.methods
    .enableKlend()
    .accountsPartial({
      admin: ctx.authority.publicKey,
      vaultConfig: ctx.vaultConfig,
      vaultAuthority: ctx.vaultAuthority,
      assetConfig: pdas.assetConfig,
      klendConfig: pdas.klendConfig,
      lendingMarket: fields.lendingMarket,
      lendingMarketAuthority: fields.lendingMarketAuthority,
      reserve,
      reserveLiquiditySupply: fields.reserveLiquiditySupply,
      collateralMint: fields.collateralMint,
      collateralVault: pdas.collateralVault,
      collateralTokenProgram: await tokenProgramOf(ctx.connection, fields.collateralMint),
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
  console.log(`[init] enable_klend tx ${sig}`);
  return record;
}

export async function init(opts: InitOptions): Promise<Deployment> {
  const ctx = loadCliContext(opts.network);
  const previous = readDeploymentIfPresent(opts.network);
  console.log(`  ${describeContext(ctx)}`);
  console.log("");

  const assetMint = opts.asset ?? opts.decimalsMint;
  if (!assetMint) {
    throw new Error("--asset (or --decimals-mint) is required: init always registers one collateral");
  }
  const asset = new PublicKey(assetMint);
  const decimalsMint = new PublicKey(opts.decimalsMint ?? assetMint);

  if (!opts.decimalsMint && !(await exists(ctx.connection, ctx.vaultConfig))) {
    throw new Error("--decimals-mint is required on first init: it fixes Florin precision forever");
  }

  await initializeVault(ctx, decimalsMint, opts.dryRun);

  const pdas = assetPdas(ctx.programId, ctx.vaultConfig, asset);
  await addAsset(ctx, asset, pdas, opts.dryRun);

  const klend = opts.reserve
    ? await enableKlend(ctx, asset, new PublicKey(opts.reserve), pdas, opts.dryRun)
    : undefined;
  if (!opts.reserve) {
    console.log("[init] no --reserve — Kamino stays off for this asset");
  }

  const deployment: Deployment = {
    cluster: opts.network,
    rpcUrl: ctx.rpcUrl,
    wsUrl: ctx.wsUrl,
    backendUrl: opts.backendUrl ?? previous?.backendUrl ?? DEFAULT_BACKEND_URL,
    programId: ctx.programId.toBase58(),
    authority: ctx.authority.publicKey.toBase58(),
    vaultConfig: ctx.vaultConfig.toBase58(),
    vaultAuthority: ctx.vaultAuthority.toBase58(),
    wrappedMint: ctx.wrappedMint.toBase58(),
    defaultAssetMint: previous?.defaultAssetMint ?? asset.toBase58(),
    assets: {
      [asset.toBase58()]: {
        mint: asset.toBase58(),
        assetConfig: pdas.assetConfig.toBase58(),
        tokenVault: pdas.tokenVault.toBase58(),
        treasuryVault: pdas.treasuryVault.toBase58(),
        ...(klend
          ? {
              klendConfig: pdas.klendConfig.toBase58(),
              collateralVault: pdas.collateralVault.toBase58(),
              ...klend,
            }
          : {}),
      },
    },
  };

  if (opts.dryRun) {
    console.log("");
    console.log(`[dry-run] would write ${relative(deploymentPath(opts.network))}`);
    return deployment;
  }

  const merged = writeDeployment(deployment);
  console.log("");
  console.log(`wrote ${relative(deploymentPath(opts.network))}`);
  return merged;
}
