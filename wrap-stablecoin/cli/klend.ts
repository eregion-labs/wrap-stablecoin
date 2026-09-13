/**
 * The KLend reserve fields `enable_klend` needs, decoded with the upstream
 * @kamino-finance/klend-sdk layout so the CLI never restates the account layout.
 */

import { Reserve } from "@kamino-finance/klend-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { KLEND_LENDING_MARKET_AUTH_SEED } from "../tests/pda-seeds";

export const KLEND_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);

/**
 * The only reserve layout version the program accepts; mirrors `RESERVE_VERSION`
 * in programs/wrap-stablecoin/src/klend/reserve.rs, so the CLI rejects a reserve
 * the on-chain parser would reject anyway.
 */
export const RESERVE_VERSION = 1;

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
  let decoded: Reserve;
  try {
    decoded = Reserve.decode(account.data);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `reserve ${reserve.toBase58()} failed to decode as a KLend reserve: ${reason}`,
    );
  }

  if (!decoded.version.eqn(RESERVE_VERSION)) {
    throw new Error(
      `reserve ${reserve.toBase58()} is version ${decoded.version.toString()}, expected ${RESERVE_VERSION}`,
    );
  }

  const lendingMarket = new PublicKey(decoded.lendingMarket);
  return {
    lendingMarket,
    lendingMarketAuthority: lendingMarketAuthority(lendingMarket),
    liquidityMint: new PublicKey(decoded.liquidity.mintPubkey),
    reserveLiquiditySupply: new PublicKey(decoded.liquidity.supplyVault),
    collateralMint: new PublicKey(decoded.collateral.mintPubkey),
  };
}
