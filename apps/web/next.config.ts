import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@revion/core"],
  serverExternalPackages: ["sharp"],
  turbopack: { root: path.resolve(process.cwd(), "../..") },
};

export default nextConfig;
