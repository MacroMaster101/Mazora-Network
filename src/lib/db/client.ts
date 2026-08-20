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

/*
  A direct Supabase connection (db.<ref>.supabase.co:5432) gives every
  serverless worker its own real Postgres backend, and Postgres caps those far
  lower than Vercel will happily spawn workers. The transaction-mode pooler
  (:6543) multiplexes many short-lived clients onto few backends, which is what
  this pool's sizing assumes.

  Getting this wrong is silent until it isn't: the app works under light load
  and then saturates in bursts, which surfaces as hung requests rather than as
  anything naming the connection string. Warned once per process, never with the
  URL itself — that string carries the database password.
*/
let warnedDirectConnection = false;

function warnIfNotPooled(rawUrl: string) {
  if (warnedDirectConnection || process.env.NODE_ENV !== "production") return;
  let host = "";
  let port = "";
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname;
    port = parsed.port;
  } catch {
    return;
  }
  if (host.includes("pooler.supabase.com") && port === "6543") return;
  warnedDirectConnection = true;
  console.error(
    "DATABASE_URL is not the Supabase transaction pooler (expected host *.pooler.supabase.com on port 6543). " +
      "Each serverless worker will open its own direct Postgres backend, which exhausts the server's connection " +
      "limit under bursts and makes requests hang waiting for a free slot.",
  );
}

export function getDb(): Database | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    cached = null;
    return cached;
  }
  /*
    Each Vercel worker has its own module cache. Leaving postgres-js at its
    default pool size (10) lets a burst of workers exhaust Supabase's shared
    pool even though every individual worker appears healthy. Five keeps
    build-time page generation concurrent, and leaves headroom for the parallel
    admin dashboard reads, without letting each serverless worker reserve ten
    connections.

    Ten rather than five because DATABASE_URL is the transaction-mode pooler,
    which multiplexes many short-lived clients onto a small number of real
    Postgres backends — that is the whole point of it. The cap that matters is
    the pooler's client limit (hundreds), not Postgres's backend limit, so a
    worker holding ten slots is cheap here in a way it would not be against a
    direct :5432 connection. Five made queries queue sooner than they needed to,
    and queuing is precisely the failure mode below.

    KNOWN GAP — the wait for a free slot is NOT bounded by anything below.
    `connect_timeout` only arms a timer around *opening* a socket
    (postgres-js src/connection.js), and `statement_timeout` only applies once a
    query is actually running. When all `max` slots are busy, postgres-js pushes
    the query onto an unbounded in-memory queue with no timer at all
    (src/index.js, `queries.push(query)`), so it waits indefinitely.

    That is how a burst of revalidated RSC requests — e.g. the three
    revalidatePath calls plus router.refresh() after an order is deleted — turned
    into functions that hung until Vercel's ceiling and returned status 0, which
    the browser reports as ERR_CONNECTION_RESET on every route sharing the pool.

    The driver exposes no queue timeout, so the bound is applied outside it:
    `maxDuration` in vercel.json caps how long a hung request can pin a worker.
    Raising `max` is NOT the fix on its own — it moves the exhaustion point from
    this pool to Supabase's, unless DATABASE_URL is the transaction-mode pooler.
  */
  warnIfNotPooled(url);

  const sql = postgres(url, {
    prepare: false,
    max: 10,
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
