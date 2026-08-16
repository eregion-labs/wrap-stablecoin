import { z } from "zod";

export const ClientConfigSchema = z.object({
  schemaVersion: z.literal(1),
  deploymentId: z.string().min(1),
  environment: z.enum(["local", "development", "staging", "production"]),
  solana: z.object({
    network: z.enum(["localnet", "devnet", "mainnet"]),
    rpcUrl: z.string().url(),
    wsUrl: z.string().min(1),
    programIds: z.object({
      wrapStablecoin: z.string().min(32),
    }),
  }),
  assets: z.object({
    defaultAssetMint: z.string().min(32),
  }),
  features: z.object({
    capabilities: z.object({
      adminDashboard: z.boolean(),
    }),
  }),
  links: z.object({
    adminDashboardUrl: z.string().url().nullable().optional(),
    publicAppUrl: z.string().url().nullable().optional(),
    explorerBaseUrl: z.string().url(),
  }),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

/** Deep-freeze a validated config document. */
export function freezeClientConfig(config: ClientConfig): Readonly<ClientConfig> {
  return Object.freeze({
    ...config,
    solana: Object.freeze({
      ...config.solana,
      programIds: Object.freeze({ ...config.solana.programIds }),
    }),
    assets: Object.freeze({ ...config.assets }),
    features: Object.freeze({
      capabilities: Object.freeze({ ...config.features.capabilities }),
    }),
    links: Object.freeze({ ...config.links }),
  });
}

export function parseClientConfig(data: unknown): Readonly<ClientConfig> {
  return freezeClientConfig(ClientConfigSchema.parse(data));
}
