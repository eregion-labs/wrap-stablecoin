import branding from "./florin.json";

export type BrandingConfig = {
  name: string;
  symbol: string;
  decimals: number;
  primaryColor: string;
  icon: string;
  website: string;
  explorer: string;
  description: string;
  coingeckoId: string | null;
  metadataUri: string;
};

export const BRANDING = branding as BrandingConfig;
