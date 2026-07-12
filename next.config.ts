import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the hot-reload cache separate from production builds. Running
  // `next build` while `next dev` is open can otherwise replace manifests the
  // development server is actively reading and cause intermittent 500 errors.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mc-heads.net" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
