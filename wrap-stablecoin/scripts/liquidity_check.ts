/**
 * Poll vault assets and exit non-zero if home vault cannot cover pool liability + cushion.
 *
 * Usage:
 *   BACKEND_URL=http://127.0.0.1:8080 npx ts-node scripts/liquidity_check.ts
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";

type VaultAsset = {
  mint: string;
  freeLiquidity: number;
  liability: number;
  liabilityUnderlying: number;
  cushion: number;
  homeSurplus: number;
  maxRedeemable: number;
};

async function main(): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/v1/vault/assets`);
  if (!res.ok) {
    console.error(`GET /v1/vault/assets failed: ${res.status} ${await res.text()}`);
    process.exit(2);
  }
  const body = (await res.json()) as { assets: VaultAsset[] };
  let failed = false;

  for (const a of body.assets) {
    const required = a.liabilityUnderlying + a.cushion;
    if (a.liability > 0 && a.freeLiquidity < required) {
      console.error(
        `[ALERT] ${a.mint}: freeLiquidity ${a.freeLiquidity} < liability+cushion ${required}`,
      );
      failed = true;
    } else {
      console.log(
        `ok ${a.mint.slice(0, 8)}… free=${a.freeLiquidity} liability=${a.liability} homeSurplus=${a.homeSurplus}`,
      );
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
