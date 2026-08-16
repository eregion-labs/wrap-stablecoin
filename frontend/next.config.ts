import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@florin/client-config"],
  experimental: {
    optimizePackageImports: ["@mui/material", "@mui/icons-material"],
  },
};

export default nextConfig;
