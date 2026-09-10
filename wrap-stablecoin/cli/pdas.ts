/** wrap_stablecoin PDA derivation. Seed strings live in tests/pda-seeds.ts. */

import { PublicKey } from "@solana/web3.js";
import {
  ASSET_CONFIG_SEED,
  COLLATERAL_VAULT_SEED,
  KLEND_CONFIG_SEED,
  TOKEN_VAULT_SEED,
  TREASURY_VAULT_SEED,
  VAULT_AUTHORITY_SEED,
  VAULT_CONFIG_SEED,
  WRAPPED_MINT_SEED,
} from "../tests/pda-seeds";

export type VaultPdas = {
  vaultConfig: PublicKey;
  vaultAuthority: PublicKey;
  wrappedMint: PublicKey;
};

export type AssetPdas = {
  assetConfig: PublicKey;
  tokenVault: PublicKey;
  treasuryVault: PublicKey;
  collateralVault: PublicKey;
  klendConfig: PublicKey;
};

function pda(programId: PublicKey, seeds: (Buffer | Uint8Array)[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export function vaultPdas(programId: PublicKey, authority: PublicKey): VaultPdas {
  const vaultConfig = pda(programId, [
    Buffer.from(VAULT_CONFIG_SEED),
    authority.toBuffer(),
  ]);
  return {
    vaultConfig,
    vaultAuthority: pda(programId, [
      Buffer.from(VAULT_AUTHORITY_SEED),
      vaultConfig.toBuffer(),
    ]),
    wrappedMint: pda(programId, [
      Buffer.from(WRAPPED_MINT_SEED),
      vaultConfig.toBuffer(),
    ]),
  };
}

export function assetPdas(
  programId: PublicKey,
  vaultConfig: PublicKey,
  underlyingMint: PublicKey,
): AssetPdas {
  const assetConfig = pda(programId, [
    Buffer.from(ASSET_CONFIG_SEED),
    vaultConfig.toBuffer(),
    underlyingMint.toBuffer(),
  ]);
  return {
    assetConfig,
    tokenVault: pda(programId, [
      Buffer.from(TOKEN_VAULT_SEED),
      assetConfig.toBuffer(),
    ]),
    treasuryVault: pda(programId, [
      Buffer.from(TREASURY_VAULT_SEED),
      assetConfig.toBuffer(),
    ]),
    collateralVault: pda(programId, [
      Buffer.from(COLLATERAL_VAULT_SEED),
      assetConfig.toBuffer(),
    ]),
    klendConfig: pda(programId, [
      Buffer.from(KLEND_CONFIG_SEED),
      assetConfig.toBuffer(),
    ]),
  };
}
