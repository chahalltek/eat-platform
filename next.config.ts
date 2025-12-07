import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow Turbopack to use system TLS certs so font downloads succeed in CI
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
