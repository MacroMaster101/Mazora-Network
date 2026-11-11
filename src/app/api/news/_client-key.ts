import { createHash } from "node:crypto";
import { normalizeClientIp } from "@/lib/net/client-ip";

/**
 * Bucket key for the news counters. Same address rules as `clientKey` in
 * lib/rate-limit.ts (rightmost trusted hop of x-forwarded-for, then x-real-ip),
 * except an IPv6 client is keyed on its /64: one household or phone is handed a
 * whole /64 and can rotate through its addresses freely, which would otherwise
 * mint a fresh "unique" visit each time. Only a truncated hash is kept.
 */
function trustedHops(): number {
  const raw = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

function rawClientIp(request: Request): string {
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length > 0) return chain[Math.max(0, chain.length - trustedHops())] ?? "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export { normalizeClientIp };

export function newsClientKey(request: Request, scope: string): string {
  const digest = createHash("sha256")
    .update(normalizeClientIp(rawClientIp(request)), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `${scope}:${digest}`;
}
