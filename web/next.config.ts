import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Note: rewrites() and headers() are NOT supported with output: "export".
  // API routing is handled by AuthContext.tsx (direct backend URL).
  // Security headers are handled by the native WebView or reverse proxy.
};

export default nextConfig;
