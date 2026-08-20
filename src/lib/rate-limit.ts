import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Fixed-window rate limiting with two tiers:
 *
 * - `rateLimit` — in-process memory. Each serverless instance keeps its own
 *   window, so the effective ceiling is `limit x instances`. Fine for what it
 *   guards directly (counter inflation on the news analytics endpoints), and
 *   it is the always-available fallback for the tier below.
 *
 * - `rateLimitShared` — a global window in Upstash Redis (plain REST, no SDK),
 *   used automatically when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
 *   are set.
 *   This is what `throttleAuthAction` — login, registration, the 6-digit
 *   reset code, support/gallery/store submissions — goes through, because
 *   those need a bound an attacker cannot multiply by fanning out across
 *   lambda instances or waiting for cold starts.
 *
 * When Redis is unconfigured or unreachable the shared tier degrades to the
 * per-instance window rather than failing the request: sign-in must not go
 * down with the rate limiter, and the in-memory window still brakes
 * single-instance abuse in the meantime.
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

/*
  Falling back to the per-instance window is deliberate — sign-in must not go
  down with the rate limiter — but in production it is a materially weaker
  control, not an equivalent one: the effective ceiling becomes limit x running
  instances, and the Discord interaction replay guard stops being global. That
  is invisible from the outside, so it is stated once in the logs rather than
  left to be discovered during an incident. Once per process, not per request,
  so it cannot itself become log spam.
*/
let warnedSharedStoreMissing = false;

function warnSharedStoreMissing() {
  if (warnedSharedStoreMissing || process.env.NODE_ENV !== "production") return;
  warnedSharedStoreMissing = true;
  console.error(
    "Rate limiting is running per-instance: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set. " +
      "Login, registration and password-reset limits are multiplied by the number of running instances, " +
      "and the Discord interaction replay guard is no longer global.",
  );
}

/** Upstash Redis REST credentials, when a shared store is provisioned. */
function sharedStoreConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token || !url.startsWith("https://")) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Fixed-window verdict backed by the shared store, falling back to the
 * in-process window when no store is configured or the call fails.
 *
 * Windows are aligned to wall-clock buckets (`floor(now / windowMs)`) so every
 * instance increments the same key without coordination. One round trip:
 * INCR + PEXPIRE pipelined. The TTL is 2x the window purely as garbage
 * collection — the bucket index in the key is what actually rolls the window.
 */
export async function rateLimitShared(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitVerdict> {
  const config = sharedStoreConfig();
  if (!config) {
    warnSharedStoreMissing();
    return rateLimit(key, { limit, windowMs });
  }

  const now = Date.now();
  const redisKey = `rl:${key}:${Math.floor(now / windowMs)}`;
  try {
    const res = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs * 2)],
      ]),
      cache: "no-store",
      // Short deadline: a slow limiter must not stall sign-in; the fallback
      // below still provides per-instance braking.
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`rate-limit store responded ${res.status}`);
    const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    if (data?.[0]?.error) throw new Error(data[0].error);
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count) || count < 1) throw new Error("rate-limit store returned no count");

    const ok = count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - count),
      retryAfter: ok ? 0 : Math.max(1, Math.ceil((windowMs - (now % windowMs)) / 1000)),
    };
  } catch (error) {
    // Never printed with the key's identity content — `key` holds only hashes.
    console.error("Shared rate limit unavailable; using per-instance window:", error);
    return rateLimit(key, { limit, windowMs });
  }
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
  const verdict = await rateLimitShared(await actionClientKey(scope, identity), { limit, windowMs });
  if (verdict.ok) return null;
  const minutes = Math.ceil(verdict.retryAfter / 60);
  return minutes > 1
    ? `Too many attempts. Try again in about ${minutes} minutes.`
    : "Too many attempts. Try again in about a minute.";
}
