import "server-only";
import { unstable_cache } from "next/cache";
import { probeDatabase } from "@/lib/db/probe";

/**
 * Is the database out right now? Read by the root layout for the outage notice.
 *
 * Every loader treats a failed read as "nothing to show", so when the database
 * is unreachable (a Supabase outage, or the project paused or restricted for
 * going over its plan's limits) the site renders as an empty site with no
 * explanation. This lets the layout say so instead.
 *
 * The answer is cached for OUTAGE_CHECK_SECONDS and, unlike the other cached
 * loaders, a "down" answer is cached too: it is a real answer, and not caching
 * it would put a probe with a timeout in front of every page view during the
 * very outage it reports. Revalidation runs in the background, so at most one
 * visitor per interval waits on a probe. An unconfigured database (local demo
 * mode) is not an outage.
 */
const OUTAGE_CHECK_SECONDS = 30;
const PROBE_TIMEOUT_MS = 2_500;

const readDatabaseDown = unstable_cache(
  async () => (await probeDatabase(PROBE_TIMEOUT_MS)) === "down",
  ["database-outage"],
  { revalidate: OUTAGE_CHECK_SECONDS },
);

export async function isDatabaseDown(): Promise<boolean> {
  try {
    return await readDatabaseDown();
  } catch {
    // No data cache (a script, a build step): show no notice rather than fail the page.
    return false;
  }
}
