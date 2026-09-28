import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cohvera/ui",
    "@cohvera/plugin-sdk",
    "@cohvera/contracts",
  ],
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://127.0.0.1:4000";
    return [
      { source: "/api/:path*", destination: `${apiUrl}/:path*` },
      { source: "/auth/:path*", destination: `${apiUrl}/auth/:path*` },
    ];
  },
};

export default nextConfig;
