import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes del monorepo que se publican como código fuente TypeScript.
  transpilePackages: ["@sax/xrf-core", "@sax/xrf-ui"],
};

export default nextConfig;
