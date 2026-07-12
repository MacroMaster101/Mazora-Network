import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit config. Works against any Postgres connection string:
 * Neon now, Supabase later — only DATABASE_URL changes.
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
