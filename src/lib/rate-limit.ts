import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Small in-process fixed-window rate limiter for the public, unauthenticated
 * API routes.
 *
 * Scope and limits, stated plainly: state lives in this process's memory, so on
 * a multi-instance/serverless deployment each instance keeps its own window and
 * the effective ceiling is `limit x instances`. That is fine for what this
 * guards — counter inflation and DB write amplification on the news analytics
 * endpoints — but it is NOT a security control for anything that needs a hard
 * global bound. Move to a shared store (Redis/Upstash) if that changes.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Ceiling on tracked keys so the limiter cannot itself become a memory leak. */
const MAX_TRACKED_KEYS = 20_000;

export type RateLimitVerdict = {
  ok: boolean;
  /** Requests still allowed in the current window. */
  remaining: number;
  /** Seconds until the window resets. Meaningful when `ok` is false. */
  retryAfter: number;
};

/** Drop expired windows; if still saturated, reset wholesale rather than grow. */
function prune(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitVerdict {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) prune(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    retryAfter: ok ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Stable per-client bucket key. The IP is hashed and truncated before it is
 * used, so no raw address is held in memory — the limiter only ever needs
 * equality, never the address itself.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const digest = createHash("sha256").update(ip, "utf8").digest("hex").slice(0, 16);
  return `${scope}:${digest}`;
}

/** Standard headers for a throttled response. */
export function retryAfterHeaders(retryAfter: number): Record<string, string> {
  return { "Retry-After": String(retryAfter), "Cache-Control": "no-store" };
}

function hashed(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

/**
 * Server-action equivalent of `clientKey`. Actions never receive a `Request`,
 * so the address comes from the incoming request headers instead.
 *
 * `identity` narrows the bucket beyond the address — pass the submitted email
 * on login so one account cannot be sprayed from a single address, while a
 * shared NAT/school IP does not lock out unrelated users quite so easily.
 */
export async function actionClientKey(scope: string, identity?: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip")?.trim() || "unknown";
  const suffix = identity ? `:${hashed(identity.toLowerCase())}` : "";
  return `${scope}:${hashed(ip)}${suffix}`;
}

/**
 * Throttle a credential-handling server action. Returns a retry message when
 * the caller is over the limit, or `null` when the action may proceed.
 *
 * The message is deliberately identical regardless of whether the account
 * exists, so throttling cannot be used to enumerate accounts.
 */
export async function throttleAuthAction(
  scope: string,
  { limit, windowMs, identity }: { limit: number; windowMs: number; identity?: string },
): Promise<string | null> {
  const verdict = rateLimit(await actionClientKey(scope, identity), { limit, windowMs });
  if (verdict.ok) return null;
  const minutes = Math.ceil(verdict.retryAfter / 60);
  return minutes > 1
    ? `Too many attempts. Try again in about ${minutes} minutes.`
    : "Too many attempts. Try again in about a minute.";
}
