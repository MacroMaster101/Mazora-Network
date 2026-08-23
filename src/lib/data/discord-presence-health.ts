import "server-only";

import { fetchWithDeadline } from "@/lib/data/upstream";
import type { PresenceSnapshot } from "@/lib/presence-status";

const DEFAULT_HEALTH_URL = "https://mazora-network.onrender.com/health";
const PING_INTERVAL_MS = 5 * 60_000;
const PING_TIMEOUT_MS = 4_000;
/**
 * Deadline for the console's on-demand health read, separate from
 * PING_TIMEOUT_MS. That constant is tuned for the keep-warm ping, which fires
 * on ordinary site traffic and must stay short. A Render free-tier cold start
 * can take tens of seconds, so reusing the 4s ping deadline here made the
 * console report the worker down on almost every first load.
 */
const HEALTH_READ_TIMEOUT_MS = 15_000;

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

export interface PresenceHealth {
  ok: boolean;
  discord: string;
  connectedAt: string | null;
  lastSnapshotAt: string | null;
  /**
   * Coerced to plain booleans (absent/malformed -> false) because this is what
   * feeds `presenceLabels`, `src/lib/presence-status.ts`'s pure renderer of
   * "the exact text sent to Discord" — a copy kept byte-for-byte identical to
   * the `discord-bot-presence` branch, so its `PresenceSnapshot` type is not
   * widened to `boolean | null` here. For a truthful "known vs unknown"
   * reading of the same two fields, see `online` below.
   */
  snapshot: PresenceSnapshot;
  /**
   * `websiteOnline` / `minecraftOnline` as the worker's response actually
   * reported them: `null` when the field was missing or not a boolean, rather
   * than `snapshot`'s silent false-default. The numeric fields already degrade
   * this honestly (see `numberOrNull`); this gives the two booleans the same
   * treatment for display, without disturbing the presence-status.ts copy.
   */
  online: { website: boolean | null; minecraft: boolean | null };
}

function boolOf(value: unknown): boolean {
  return value === true;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Read the standalone worker's /health document.
 *
 * Deliberately separate from pingDiscordPresence(): that call is a keep-warm
 * ping that discards the body and rate-limits itself to one request per five
 * minutes. The console needs the body, and needs it now.
 */
export async function readPresenceHealth(): Promise<
  { ok: true; health: PresenceHealth } | { ok: false; reason: string }
> {
  const url = discordPresenceHealthUrl();
  if (!url) return { ok: false, reason: "DISCORD_PRESENCE_HEALTH_URL is not a valid HTTPS URL." };

  const response = await fetchWithDeadline(
    url,
    { cache: "no-store", headers: { "User-Agent": "MazoraNetworkWebsite/1.0" } },
    HEALTH_READ_TIMEOUT_MS,
  );
  if (!response || !response.ok) return { ok: false, reason: "The presence worker did not respond." };

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "The presence worker returned a malformed response." };
  }

  const websiteOnline = boolOrNull(body.websiteOnline);
  const minecraftOnline = boolOrNull(body.minecraftOnline);

  return {
    ok: true,
    health: {
      ok: boolOf(body.ok),
      discord: stringOrNull(body.discord) ?? "unknown",
      connectedAt: stringOrNull(body.connectedAt),
      lastSnapshotAt: stringOrNull(body.lastSnapshotAt),
      snapshot: {
        websiteOnline: websiteOnline ?? false,
        minecraftOnline: minecraftOnline ?? false,
        minecraftPlayers: numberOrNull(body.minecraftPlayers),
        minecraftMax: numberOrNull(body.minecraftMax),
        discordOnline: numberOrNull(body.discordOnline),
        discordMembers: numberOrNull(body.discordMembers),
      },
      online: { website: websiteOnline, minecraft: minecraftOnline },
    },
  };
}
