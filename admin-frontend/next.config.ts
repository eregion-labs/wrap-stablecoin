import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@florin/client-config",
    "@mui/material",
    "@mui/system",
    "@emotion/react",
    "@emotion/styled",
  ],
};

export default nextConfig;
