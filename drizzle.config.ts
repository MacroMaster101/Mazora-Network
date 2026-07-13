import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit config. Runs against the Supabase Postgres database via the
 * DATABASE_URL connection string.
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
} satisfies Config;
