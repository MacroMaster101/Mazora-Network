import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { ServerStatus } from "@/lib/types";

/**
 * Rolling 24-hour record of real server status.
 *
 * The activity chart on /play used to invent its own history: a sine curve for
 * player counts and two hardcoded "degraded" incidents with fabricated outage
 * durations. It read convincingly and was entirely fictional, because nothing
 * in the project had ever stored an hourly reading.
 *
 * This is that store. Samples are written from the /api/status route, which the
 * standalone Discord presence worker already polls once a minute — so recording
 * costs no extra scheduling and never runs on a page render. Hours with no
 * sample stay absent rather than being filled in, so a fresh deployment shows a
 * mostly empty chart that fills over the first day. An honest gap is worth more
 * than a plausible invention.
 *
 * Stored in site_settings rather than its own table: it is one small JSON
 * document with a fixed 24-row bound, matching how the news counters already
 * use that table.
 */

const TELEMETRY_KEY = "status.telemetry_24h";
const WINDOW_HOURS = 24;

/*
  /api/status is public, unauthenticated and force-dynamic, so "the presence
  worker polls once a minute" describes the intended caller, not the only
  possible one. Without this guard anyone could drive a read-modify-write of the
  telemetry row per request, and — worse than the load — inflate `totalProbes`
  by curling the endpoint while the server is healthy, diluting a real outage in
  the "N of M checks failed" ratio until it read as a rounding error.

  One write per minute per warm instance is the cadence the worker actually
  needs, and it makes request volume irrelevant to what gets recorded.
*/
const MIN_WRITE_INTERVAL_MS = 60_000;
let lastWriteAt = 0;

export interface StatusSample {
  /** Start of the hour this sample covers, as an ISO timestamp. */
  hour: string;
  /** Whether the server answered at any point during the hour. */
  online: boolean;
  /** Highest concurrent player count observed in the hour. */
  players: number;
  /** Highest capacity reported in the hour; 0 when never reported. */
  maxPlayers: number;
  /** Most recent non-zero latency observed in the hour; 0 when never reachable. */
  ping: number;
  /** Probes in this hour that found the server down. */
  downProbes: number;
  /** Total probes recorded in this hour. */
  totalProbes: number;
}

/** Truncates to the start of the containing hour. */
function hourKey(date: Date): string {
  const truncated = new Date(date);
  truncated.setMinutes(0, 0, 0);
  return truncated.toISOString();
}

function isSample(value: unknown): value is StatusSample {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StatusSample>;
  return typeof candidate.hour === "string" && typeof candidate.online === "boolean";
}

/** Drops anything older than the window and anything malformed. */
function normalise(raw: unknown, now: Date): StatusSample[] {
  if (!Array.isArray(raw)) return [];
  const cutoff = now.getTime() - WINDOW_HOURS * 60 * 60 * 1000;
  return raw
    .filter(isSample)
    .filter((sample) => {
      const at = new Date(sample.hour).getTime();
      return Number.isFinite(at) && at >= cutoff;
    })
    .sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime())
    .slice(-WINDOW_HOURS);
}

/** The recorded window, oldest first. Empty when nothing has been recorded yet. */
export async function getStatusTelemetry(): Promise<StatusSample[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, TELEMETRY_KEY))
      .limit(1);
    return normalise(row?.value, new Date());
  } catch (error) {
    console.error("Failed to load status telemetry:", error);
    return [];
  }
}

/**
 * Folds one live reading into the current hour's bucket.
 *
 * Deliberately best-effort and never thrown from: this runs in `after()` on a
 * status request, and losing a sample must never turn into a failed response.
 *
 * Read-modify-write, so two probes landing in the same instant can cost one
 * sample (last writer wins). With a single worker polling once a minute that is
 * a non-issue, and the failure mode is a slightly less precise peak rather than
 * corruption.
 */
export async function recordStatusSample(status: ServerStatus): Promise<void> {
  const db = getDb();
  // A reading we could not take is not a reading of "offline" — without a live
  // provider there is nothing meaningful to record.
  if (!db || !status.live) return;

  // See MIN_WRITE_INTERVAL_MS: request volume must not become sample volume.
  const startedAt = Date.now();
  if (startedAt - lastWriteAt < MIN_WRITE_INTERVAL_MS) return;
  lastWriteAt = startedAt;

  const now = new Date();
  const key = hourKey(now);

  try {
    const existing = await getStatusTelemetry();
    const current = existing.find((sample) => sample.hour === key);

    const merged: StatusSample = {
      hour: key,
      online: (current?.online ?? false) || status.online,
      players: Math.max(current?.players ?? 0, status.online ? status.players : 0),
      maxPlayers: Math.max(current?.maxPlayers ?? 0, status.online ? status.max : 0),
      // Keep the latest real latency; a down probe reports 0 and must not erase it.
      ping: status.online && status.ping > 0 ? status.ping : current?.ping ?? 0,
      downProbes: (current?.downProbes ?? 0) + (status.online ? 0 : 1),
      totalProbes: (current?.totalProbes ?? 0) + 1,
    };

    const next = normalise(
      [...existing.filter((sample) => sample.hour !== key), merged],
      now,
    );

    await db
      .insert(schema.siteSettings)
      .values({ settingKey: TELEMETRY_KEY, settingValue: next })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: { settingValue: next, updatedAt: now },
      });
  } catch (error) {
    console.error("Failed to record status telemetry:", error);
  }
}
