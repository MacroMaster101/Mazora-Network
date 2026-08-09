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
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        /*
          Artwork under /public is served with `max-age=0` by default, so every
          repeat visit re-validates files that have not changed in months — the
          CSS backdrops in particular, which are fetched on every route.

          30 days rather than a year with `immutable`, because these filenames
          are not content-hashed: `mazora-logo.webp` keeps its name when the art
          behind it is replaced. `stale-while-revalidate` still serves instantly
          from cache for up to a year while a fresh copy is fetched in the
          background, so the repeat-visit cost is the same without pinning a
          stale logo into browsers that cannot be reached. Art that must turn
          over immediately gets a new `-vN` filename, which is already the
          convention in /public/images.
        */
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" },
        ],
      },
    ];
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
    /*
      The defaults jump from 384 -> 640 for fixed artwork and from 1200 ->
      1920 for viewport-wide artwork. Those gaps made the 390px brand lockup
      and a typical 1366px hero substantially larger than their rendered size
      in Lighthouse. Keep candidates close to the layouts we actually ship.
    */
    deviceSizes: [360, 420, 640, 750, 828, 1080, 1200, 1366, 1440, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 160, 256, 320, 384],
    qualities: [60, 70, 75, 90],
    // Prefer AVIF when supported; WebP remains the automatic fallback.
    formats: ["image/avif", "image/webp"],
    /*
      Optimised images are content-addressed by (src, width, quality), so a long
      TTL is safe and is what makes routing third-party avatars through the
      optimiser worthwhile: mc-heads.net serves a 1-hour cache lifetime, and
      anything proxied here is re-served with this one instead. Next's default
      is 60 seconds, which would have re-fetched avatars on nearly every visit.
    */
    minimumCacheTTL: 2592000,
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
