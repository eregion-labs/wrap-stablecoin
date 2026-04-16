import path from "path";
import type { NextConfig } from "next";

// Lock Turbopack to this package so a lockfile higher up (e.g. ~/Documents/yarn.lock) does not become the inferred workspace root.
const turbopackRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  transpilePackages: [
    "@mui/material",
    "@mui/system",
    "@emotion/react",
    "@emotion/styled",
  ],
};

export default nextConfig;
