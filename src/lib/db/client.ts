/**
 * Database client. Returns a Drizzle instance over the Neon serverless driver
 * when DATABASE_URL is set, otherwise null so callers fall back to demo data.
 *
 * Swapping to Supabase later means only changing DATABASE_URL to the Supabase
 * Postgres connection string — this file and every repository stay the same.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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
  const sql = neon(url);
  cached = drizzle(sql, { schema });
  return cached;
}

export { schema };
