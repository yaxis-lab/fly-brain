import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //serverExternalPackages: ["duckdb"],
  serverExternalPackages: [
    "@duckdb/node-api",
    "@duckdb/node-bindings", // <-- Add this new line
  ],
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        path: false,
        url: false,
      };
    }
    return config;
  },
};

export default nextConfig;
