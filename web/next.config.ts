import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //serverExternalPackages: ["duckdb"],
  serverExternalPackages: [
    "@duckdb/node-api",
    "@duckdb/node-bindings", // <-- Add this new line
  ],
};

export default nextConfig;
