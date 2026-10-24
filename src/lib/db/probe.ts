import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export type DatabaseReachability = "ok" | "down" | "unconfigured";

/**
 * One trivial query, bounded by `timeoutMs`: is the database answering?
 *
 * Shared by the deep health check and the outage notice. It never says why a
 * check failed; callers only learn up or down.
 */
export async function probeDatabase(timeoutMs: number): Promise<DatabaseReachability> {
  const db = getDb();
  if (!db) return "unconfigured";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answered = await Promise.race([
      db.execute(sql`select 1`).then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
    return answered ? "ok" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}
