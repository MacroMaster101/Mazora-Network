import type { NextConfig } from "next";

// Content Security Policy.
//
// script-src / style-src keep 'unsafe-inline' because the app ships an inline
// theme-no-flash script (src/app/layout.tsx) and inline styles, and Next.js's
// hydration bootstrap is inline; locking these down requires per-request
// nonces threaded through middleware, which is a larger change. Everything
// else is tightened: framing is denied, plugins/objects are blocked, and the
// document base and form targets are pinned to same-origin.
//
// 'unsafe-eval' is added in development ONLY: `next dev` evaluates every client
// module through eval() (webpack's eval-source-map devtool) and React Refresh
// does the same. Without it the whole client bundle throws EvalError, nothing
// hydrates, and the site is stuck on the first-load screen. Production bundles
// never eval, so the deployed policy stays strict.
const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
let supabaseImageOrigin = "";
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
    supabaseImageOrigin = parsed.origin;
    supabaseImagePattern = {
      protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: "/storage/v1/object/**",
    };
  } catch {
    // Invalid environment values are handled by the existing Supabase config.
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://mc-heads.net https://api.dicebear.com https://cdn.discordapp.com${supabaseImageOrigin ? ` ${supabaseImageOrigin}` : ""}`,
  "font-src 'self'",
  // https: covers the env-configured Supabase host without hard-coding it.
  // ws: is dev-only, for the hot-reload socket.
  `connect-src 'self' https:${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
