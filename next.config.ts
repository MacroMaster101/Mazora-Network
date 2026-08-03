import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
let supabaseImagePattern: {
  protocol: "http" | "https";
  hostname: string;
  port: string;
  pathname: string;
} | null = null;

if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    const protocol = parsed.protocol === "http:" ? "http" : "https";
    supabaseImagePattern = {
      protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: "/storage/v1/object/**",
    };
  } catch (error) {
    // A malformed NEXT_PUBLIC_SUPABASE_URL is handled by the Supabase config
    // module, but this must not stay silent: swallowing everything here once hid
    // a ReferenceError, which quietly dropped Supabase from remotePatterns and
    // broke every stored image with no signal anywhere.
    console.warn("Could not derive the Supabase image pattern:", error);
  }
}

// Content-Security-Policy is NOT here: it needs a per-request nonce, so it is
// built and attached in src/middleware.ts (see src/lib/csp.ts). Everything below
// is static and safe to serve from the config.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Keep the hot-reload cache separate from production builds. Running
  // `next build` while `next dev` is open can otherwise replace manifests the
  // development server is actively reading and cause intermittent 500 errors.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: { bodySizeLimit: "9mb" },
  },
  images: {
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "mc-heads.net" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      ...(supabaseImagePattern ? [supabaseImagePattern] : []),
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
