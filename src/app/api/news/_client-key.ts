import { createHash } from "node:crypto";

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

/** The first four hextets of an IPv6 address as a /64 prefix, or the input unchanged for anything else. */
export function normalizeClientIp(ip: string): string {
  let value = ip.trim().replace(/^\[|\]$/g, "");
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(":")) return ip;

  // An IPv4-mapped address is an IPv4 client.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) return mapped[1];

  let head: string[];
  let tail: string[] = [];
  const gap = value.indexOf("::");
  if (gap !== -1) {
    if (value.indexOf("::", gap + 1) !== -1) return ip;
    head = value.slice(0, gap).split(":").filter(Boolean);
    tail = value.slice(gap + 2).split(":").filter(Boolean);
    if (head.length + tail.length > 7) return ip;
    head = [...head, ...Array<string>(8 - head.length - tail.length).fill("0"), ...tail];
  } else {
    head = value.split(":");
  }
  if (head.length !== 8 || !head.every((h) => /^[0-9a-f]{1,4}$/i.test(h))) return ip;
  return `${head.slice(0, 4).map((h) => h.toLowerCase().padStart(4, "0")).join(":")}::/64`;
}

export function newsClientKey(request: Request, scope: string): string {
  const digest = createHash("sha256")
    .update(normalizeClientIp(rawClientIp(request)), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `${scope}:${digest}`;
}
