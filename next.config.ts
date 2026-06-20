import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["xlsx", "@prisma/client", "prisma"],
};

export default nextConfig;
