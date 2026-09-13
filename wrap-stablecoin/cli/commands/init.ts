/**
 * Vault bootstrap for any cluster: initialize -> add_asset -> enable_klend.
 *
 * A step whose account already exists is skipped after checking it against the
 * requested parameters (a mismatch fails), and the artifact records the on-chain
 * values, so re-running is safe and registering a second collateral is just
 * another `init --asset`.
 */

import { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { CliContext, describeContext, loadCliContext } from "../context";
import {
  assertSameVault,
  DeployedAsset,
  Deployment,
  deploymentPath,
  readDeploymentIfPresent,
  relative,
  writeDeployment,
} from "../deployments";
import { readReserveFields } from "../klend";
import { clientRpcUrl, Network } from "../network";
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

/**
 * Florin precision is fixed at initialize, so an existing vault_config must
 * already carry the decimals of an explicitly requested --decimals-mint.
 */
async function initializeVault(
  ctx: CliContext,
  decimalsMint: PublicKey | undefined,
  dryRun: boolean,
): Promise<void> {
  const onChain = await ctx.program.account.vaultConfig.fetchNullable(ctx.vaultConfig);
  if (onChain) {
    if (decimalsMint) {
      const { decimals } = await getMint(
        ctx.connection,
        decimalsMint,
        undefined,
        await tokenProgramOf(ctx.connection, decimalsMint),
      );
      if (decimals !== onChain.wrappedDecimals) {
        throw new Error(
          `vault_config already uses ${onChain.wrappedDecimals} decimals, but --decimals-mint ` +
            `${decimalsMint.toBase58()} has ${decimals}`,
        );
      }
    }
    console.log("[init] vault_config exists — skip initialize");
    return;
  }
  if (!decimalsMint) {
    throw new Error("--decimals-mint is required on first init: it fixes Florin precision forever");
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

type KlendRecord = Required<
  Pick<DeployedAsset, "klendConfig" | "collateralVault" | "reserve" | "lendingMarket">
>;

function klendRecord(
  klendConfig: PublicKey,
  collateralVault: PublicKey,
  reserve: PublicKey,
  lendingMarket: PublicKey,
): KlendRecord {
  return {
    klendConfig: klendConfig.toBase58(),
    collateralVault: collateralVault.toBase58(),
    reserve: reserve.toBase58(),
    lendingMarket: lendingMarket.toBase58(),
  };
}

/**
 * An existing klend_config is recorded as it is on chain; a requested --reserve
 * must match it. Otherwise Kamino is enabled only when --reserve is given.
 */
async function reconcileKlend(
  ctx: CliContext,
  asset: PublicKey,
  reserve: PublicKey | undefined,
  pdas: ReturnType<typeof assetPdas>,
  dryRun: boolean,
): Promise<KlendRecord | undefined> {
  const onChain = await ctx.program.account.kLendConfig.fetchNullable(pdas.klendConfig);
  if (onChain) {
    if (reserve && !onChain.reserve.equals(reserve)) {
      throw new Error(
        `klend_config already uses reserve ${onChain.reserve.toBase58()}, not ${reserve.toBase58()}`,
      );
    }
    console.log("[init] klend_config exists — skip enable_klend");
    return klendRecord(
      pdas.klendConfig,
      onChain.collateralVault,
      onChain.reserve,
      onChain.lendingMarket,
    );
  }
  if (!reserve) {
    console.log("[init] no --reserve — Kamino stays off for this asset");
    return undefined;
  }
  return enableKlend(ctx, asset, reserve, pdas, dryRun);
}

async function enableKlend(
  ctx: CliContext,
  asset: PublicKey,
  reserve: PublicKey,
  pdas: ReturnType<typeof assetPdas>,
  dryRun: boolean,
): Promise<KlendRecord> {
  const fields = await readReserveFields(ctx.connection, reserve);
  if (!fields.liquidityMint.equals(asset)) {
    throw new Error(
      `reserve ${reserve.toBase58()} lends ${fields.liquidityMint.toBase58()}, not ${asset.toBase58()}`,
    );
  }
  const record = klendRecord(pdas.klendConfig, pdas.collateralVault, reserve, fields.lendingMarket);

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

function buildDeployment(
  ctx: CliContext,
  opts: InitOptions,
  previous: Deployment | undefined,
  clientRpc: string,
  asset: PublicKey,
  pdas: ReturnType<typeof assetPdas>,
  klend: KlendRecord | undefined,
): Deployment {
  return {
    cluster: opts.network,
    rpcUrl: ctx.rpcUrl,
    clientRpcUrl: clientRpc,
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
        ...klend,
      },
    },
  };
}

export async function init(opts: InitOptions): Promise<Deployment> {
  const ctx = loadCliContext(opts.network);
  // Resolved before any transaction so a missing mainnet key fails up front.
  const clientRpc = clientRpcUrl(opts.network);
  const previous = readDeploymentIfPresent(opts.network);
  assertSameVault(previous, {
    cluster: opts.network,
    programId: ctx.programId.toBase58(),
    authority: ctx.authority.publicKey.toBase58(),
  });
  console.log(`  ${describeContext(ctx)}`);
  console.log("");

  const assetMint = opts.asset ?? opts.decimalsMint;
  if (!assetMint) {
    throw new Error("--asset (or --decimals-mint) is required: init always registers one collateral");
  }
  const asset = new PublicKey(assetMint);

  await initializeVault(
    ctx,
    opts.decimalsMint ? new PublicKey(opts.decimalsMint) : undefined,
    opts.dryRun,
  );

  const pdas = assetPdas(ctx.programId, ctx.vaultConfig, asset);
  await addAsset(ctx, asset, pdas, opts.dryRun);

  const klend = await reconcileKlend(
    ctx,
    asset,
    opts.reserve ? new PublicKey(opts.reserve) : undefined,
    pdas,
    opts.dryRun,
  );

  const deployment = buildDeployment(ctx, opts, previous, clientRpc, asset, pdas, klend);

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
