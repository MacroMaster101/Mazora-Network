import "server-only";

import { fetchWithDeadline } from "@/lib/data/upstream";

const DEFAULT_HEALTH_URL = "https://mazora-network.onrender.com/health";
const PING_INTERVAL_MS = 5 * 60_000;
const PING_TIMEOUT_MS = 4_000;

let nextPingAt = 0;
let pendingPing: Promise<void> | null = null;

/**
 * Resolve the server-only Render health endpoint. Production only accepts
 * HTTPS so a bad environment value cannot turn page traffic into requests to
 * an insecure or local destination.
 */
export function discordPresenceHealthUrl(): string | null {
  const configured = process.env.DISCORD_PRESENCE_HEALTH_URL?.trim() || DEFAULT_HEALTH_URL;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Best-effort backup wake request for the standalone Discord bot. A process
 * cache prevents ordinary route traffic from pinging Render more than once per
 * five minutes; Vercel instances do not share memory, so this is intentionally
 * an optimization rather than a global rate-limit guarantee.
 */
export function pingDiscordPresence(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return Promise.resolve();

  const now = Date.now();
  if (pendingPing) return pendingPing;
  if (now < nextPingAt) return Promise.resolve();

  const url = discordPresenceHealthUrl();
  if (!url) return Promise.resolve();

  // Reserve the interval before starting so concurrent requests coalesce even
  // when the upstream is slow or temporarily unavailable.
  nextPingAt = now + PING_INTERVAL_MS;
  pendingPing = fetchWithDeadline(
    url,
    {
      cache: "no-store",
      headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
    },
    PING_TIMEOUT_MS,
  )
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      pendingPing = null;
    });

  return pendingPing;
}
