/**
 * Full data + storage backup, for a project on a plan without managed backups.
 *
 * Usage:
 *   npm run backup                 -> backups/<timestamp>/
 *   npm run backup -- --out D:/mz  -> somewhere else (an external drive, say)
 *   npm run backup -- --no-auth    -> skip auth.users (see the warning below)
 *
 * ---------------------------------------------------------------------------
 * What this does and does not cover
 * ---------------------------------------------------------------------------
 * The SCHEMA is not dumped, on purpose — it already lives in supabase/migrations
 * under version control, and a dump would be a second copy free to disagree
 * with it. Restoring means running the migrations, then loading this data.
 *
 * What is dumped is everything that only exists in the database:
 *   - every table in `public`, as newline-delimited JSON
 *   - `auth.users` and `auth.identities`, without which the restored rows are
 *     orphans: every profile, order and suggestion is keyed to a user id
 *   - every object in every storage bucket, byte for byte
 *
 * ---------------------------------------------------------------------------
 * The auth dump is sensitive
 * ---------------------------------------------------------------------------
 * `auth.users` carries bcrypt password hashes and email addresses. That is the
 * single most sensitive artefact this repository can produce. It is included
 * because a backup that forces every member to reset their password is not
 * really a backup — but treat the output directory accordingly: it is
 * gitignored, and it does not belong in cloud sync or a shared drive.
 *
 * `--no-auth` omits it if you only want a content backup to hand around.
 *
 * ---------------------------------------------------------------------------
 * NDJSON rather than SQL INSERTs
 * ---------------------------------------------------------------------------
 * One row per line: readable, greppable, streamable, and restorable in any
 * order you like. A 200 MB SQL file that fails on line 40,000 tells you very
 * little; a line-per-row file tells you exactly which row.
 */
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const AUTH_TABLES = ["users", "identities"];

interface TableReport {
  table: string;
  rows: number;
  file: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const skipAuth = process.argv.includes("--no-auth");

async function dumpTable(
  sql: postgres.Sql,
  schema: string,
  table: string,
  outDir: string,
): Promise<TableReport> {
  const relative = path.join("db", `${schema}.${table}.ndjson`);
  const file = path.join(outDir, relative);
  await mkdir(path.dirname(file), { recursive: true });

  const stream = createWriteStream(file, { encoding: "utf8" });
  let rows = 0;

  // Cursor rather than a plain select: a table large enough to matter is a
  // table too large to hold in memory, and the whole point of this script is
  // that it still works when the data has grown.
  const cursor = sql`select * from ${sql(schema)}.${sql(table)}`.cursor(500);
  for await (const batch of cursor) {
    for (const row of batch) {
      stream.write(`${JSON.stringify(row)}\n`);
      rows += 1;
    }
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((error?: Error) => (error ? reject(error) : resolve()));
  });
  return { table: `${schema}.${table}`, rows, file: relative };
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set in .env.");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(arg("out") ?? path.join("backups", stamp));
  await mkdir(outDir, { recursive: true });

  // A backup connection must never be the thing that takes the site down, so
  // it takes one connection and gives up rather than queueing behind traffic.
  const sql = postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 30 });

  const started = Date.now();
  const tables: TableReport[] = [];

  try {
    const publicTables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `;
    console.log(`Dumping ${publicTables.length} public tables...`);
    for (const { tablename } of publicTables) {
      const report = await dumpTable(sql, "public", tablename, outDir);
      tables.push(report);
      console.log(`  public.${tablename.padEnd(32)} ${String(report.rows).padStart(7)} rows`);
    }

    if (skipAuth) {
      console.log("\nSkipping auth tables (--no-auth).");
    } else {
      console.log("\nDumping auth tables (contains password hashes — handle with care)...");
      for (const table of AUTH_TABLES) {
        const report = await dumpTable(sql, "auth", table, outDir);
        tables.push(report);
        console.log(`  auth.${table.padEnd(34)} ${String(report.rows).padStart(7)} rows`);
      }
    }

    const [{ size }] = await sql<{ size: string }[]>`
      select pg_size_pretty(pg_database_size(current_database())) as size
    `;

    const manifest = {
      takenAt: new Date().toISOString(),
      databaseSize: size,
      includesAuth: !skipAuth,
      totalRows: tables.reduce((sum, t) => sum + t.rows, 0),
      durationMs: Date.now() - started,
      tables,
      restore: [
        "1. Create a fresh Supabase project.",
        "2. Apply supabase/migrations in filename order (npm run db:apply -- <file>).",
        "3. Load db/auth.users.ndjson and db/auth.identities.ndjson FIRST — every",
        "   other table has a foreign key pointing at auth.users.",
        "4. Load the remaining db/*.ndjson files.",
        "5. Re-upload storage/ into buckets of the same names (npm run backup:storage restores nothing on its own).",
      ],
      warning: skipAuth
        ? undefined
        : "db/auth.users.ndjson contains bcrypt password hashes and email addresses. Do not commit, sync, or share this directory.",
    };
    await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    console.log(`\n✓ ${manifest.totalRows} rows from ${tables.length} tables`);
    console.log(`  ${outDir}`);
    console.log(`  Storage objects are a separate step: npm run backup:storage`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
