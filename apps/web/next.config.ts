import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cohvera/ui", "@cohvera/plugin-sdk", "@cohvera/contracts"],
};

export default nextConfig;
