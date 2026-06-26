import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mui/material",
    "@mui/system",
    "@emotion/react",
    "@emotion/styled",
  ],
};

export default nextConfig;
