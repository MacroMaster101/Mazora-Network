/**
 * Database client. Returns a Drizzle instance over the Supabase Postgres
 * database (via the postgres-js driver) when DATABASE_URL is set, otherwise
 * null so callers fall back to demo data.
 *
 * DATABASE_URL is the Supabase connection string — use the connection pooler
 * URL (Project Settings → Database → Connection pooling) for serverless/Next.js.
 * `prepare: false` is required when connecting through Supabase's pooler.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null | undefined;

export function getDb(): Database | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    cached = null;
    return cached;
  }
  // Each Vercel worker has its own module cache. Leaving postgres-js at its
  // default pool size (10) lets a burst of workers exhaust Supabase's shared
  // pool even though every individual worker appears healthy. Three keeps
  // build-time page generation concurrent without allowing each serverless
  // worker to reserve ten connections.
  const sql = postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: {
      /*
        connect_timeout above only bounds *opening* a connection; a query that
        has already started has no deadline of its own, so a slow or blocked
        statement holds one of the three slots indefinitely and every later
        query queues behind it with nothing to time it out. That is how a
        single page stalled past Next's 60s export budget and failed a
        production build.

        statement_timeout is enforced by Postgres itself, so it applies no
        matter which caller is waiting: a stuck query is cancelled, its slot is
        returned, and the caller gets an error its existing catch handles
        (every data function already falls back to an empty list). Fifteen
        seconds is far above the normal range for these queries — this is a
        backstop against hanging, not a performance budget.
      */
      statement_timeout: 15_000,
    },
  });
  cached = drizzle(sql, { schema });
  return cached;
}

export { schema };
