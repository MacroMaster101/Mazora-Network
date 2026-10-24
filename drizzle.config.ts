import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit config. Runs against the Supabase Postgres database via the
 * DATABASE_URL connection string.
 *
 * `out` is a scratch folder, never supabase/migrations. That folder is the
 * Supabase CLI's numbered history with no Drizzle journal, so generating into
 * it wrote a whole-schema "create everything" migration beside the real ones,
 * which the next `supabase db push` would then try to apply. Generate here,
 * read the SQL, and copy what is needed into a numbered migration by hand.
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/generated",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
} satisfies Config;
