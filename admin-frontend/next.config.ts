import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@florin/client-config", "@florin/ui"],
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
};

export default nextConfig;
