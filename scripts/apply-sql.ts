/**
 * One-off SQL runner. Applies a single .sql file to the database at
 * DATABASE_URL — handy for hand-written migrations in supabase/migrations when
 * the Supabase CLI migration flow isn't set up.
 *
 * Usage: npm run db:apply -- supabase/migrations/005_extend_role_ladder.sql
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run db:apply -- <path-to-sql-file>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set in .env.");
    process.exit(1);
  }

  const content = readFileSync(file, "utf8");
  const sql = postgres(url, { prepare: false });
  try {
    await sql.unsafe(content);
    console.log(`✓ Applied ${file}`);
  } catch (err) {
    console.error(`✗ Failed to apply ${file}:`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
