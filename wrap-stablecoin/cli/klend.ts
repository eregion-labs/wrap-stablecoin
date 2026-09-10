/**
 * The KLend reserve fields `enable_klend` needs, read straight off the account.
 * Keep offsets in sync with programs/wrap-stablecoin/src/klend/reserve.rs —
 * the on-chain handler validates the same layout.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { KLEND_LENDING_MARKET_AUTH_SEED } from "../tests/pda-seeds";

export const KLEND_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);

const RESERVE_DISCRIMINATOR = Buffer.from([
  0x2b, 0xf2, 0xcc, 0xca, 0x1a, 0xf7, 0x3b, 0x7f,
]);
const RESERVE_VERSION = 1n;
const VERSION_OFFSET = 8;
const LENDING_MARKET_OFFSET = 32;
const LIQUIDITY_MINT_OFFSET = 128;
const LIQUIDITY_SUPPLY_OFFSET = 160;
const COLLATERAL_MINT_OFFSET = 2560;
const MIN_RESERVE_LEN = COLLATERAL_MINT_OFFSET + 32;

export type ReserveFields = {
  lendingMarket: PublicKey;
  lendingMarketAuthority: PublicKey;
  liquidityMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  collateralMint: PublicKey;
};

export function lendingMarketAuthority(lendingMarket: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(KLEND_LENDING_MARKET_AUTH_SEED), lendingMarket.toBuffer()],
    KLEND_PROGRAM_ID,
  )[0];
}

export async function readReserveFields(
  connection: Connection,
  reserve: PublicKey,
): Promise<ReserveFields> {
  const account = await connection.getAccountInfo(reserve);
  if (!account) {
    throw new Error(`KLend reserve not found: ${reserve.toBase58()}`);
  }
  if (!account.owner.equals(KLEND_PROGRAM_ID)) {
    throw new Error(
      `reserve ${reserve.toBase58()} is owned by ${account.owner.toBase58()}, not KLend`,
    );
  }
  const data = account.data;
  if (data.length < MIN_RESERVE_LEN) {
    throw new Error(
      `reserve ${reserve.toBase58()} is ${data.length} bytes, expected at least ${MIN_RESERVE_LEN}`,
    );
  }
  if (!data.subarray(0, 8).equals(RESERVE_DISCRIMINATOR)) {
    throw new Error(`reserve ${reserve.toBase58()} has an unexpected discriminator`);
  }
  const version = data.readBigUInt64LE(VERSION_OFFSET);
  if (version !== RESERVE_VERSION) {
    throw new Error(
      `reserve ${reserve.toBase58()} is version ${version}, expected ${RESERVE_VERSION}`,
    );
  }

  const readKey = (offset: number) => new PublicKey(data.subarray(offset, offset + 32));
  const lendingMarket = readKey(LENDING_MARKET_OFFSET);
  return {
    lendingMarket,
    lendingMarketAuthority: lendingMarketAuthority(lendingMarket),
    liquidityMint: readKey(LIQUIDITY_MINT_OFFSET),
    reserveLiquiditySupply: readKey(LIQUIDITY_SUPPLY_OFFSET),
    collateralMint: readKey(COLLATERAL_MINT_OFFSET),
  };
}
