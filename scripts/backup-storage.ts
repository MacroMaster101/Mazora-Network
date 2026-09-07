/**
 * Downloads every storage object to disk, alongside the database backup.
 *
 * Usage:
 *   npm run backup:storage                  -> backups/<latest>/storage/
 *   npm run backup:storage -- --out D:/mz   -> a specific directory
 *
 * Storage is the larger half of this project's data by a wide margin — the
 * database is tens of megabytes, the news images are hundreds — and it is the
 * half that cannot be regenerated. A product image or a member's avatar exists
 * nowhere else once the bucket is gone.
 *
 * Objects are written under their real key, so `news-images/custom/abc-1.webp`
 * lands at `storage/news-images/custom/abc-1.webp` and the tree can be walked
 * back into a new project with the paths intact.
 *
 * Already-downloaded files are skipped by size, which makes a second run an
 * incremental top-up rather than a full re-download.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE = 100;
/** Concurrent downloads. Enough to be quick, few enough to stay a good citizen. */
const CONCURRENCY = 5;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Most recent backups/<timestamp> directory, so this pairs with `npm run backup`. */
async function latestBackupDir(): Promise<string> {
  const root = path.resolve("backups");
  try {
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    if (entries.length > 0) return path.join(root, entries[entries.length - 1]);
  } catch {
    /* no backups yet */
  }
  return path.join(root, new Date().toISOString().replace(/[:.]/g, "-"));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.");
  }

  const outDir = path.resolve(arg("out") ?? (await latestBackupDir()));
  const storageDir = path.join(outDir, "storage");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError || !buckets) throw new Error(`Could not list buckets: ${bucketError?.message}`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  for (const bucket of buckets) {
    console.log(`\nBucket: ${bucket.name}`);

    // Buckets are trees, and list() is per-prefix, so walk it.
    const queue: string[] = [""];
    const objects: { key: string; size: number }[] = [];
    while (queue.length > 0) {
      const prefix = queue.shift()!;
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await admin.storage
          .from(bucket.name)
          .list(prefix, { limit: PAGE, offset });
        if (error) throw new Error(`list ${bucket.name}/${prefix}: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const entry of data) {
          const key = prefix ? `${prefix}/${entry.name}` : entry.name;
          // A folder placeholder has no id; a real object always has one.
          if (entry.id) objects.push({ key, size: Number(entry.metadata?.size ?? 0) });
          else queue.push(key);
        }
        if (data.length < PAGE) break;
      }
    }

    console.log(`  ${objects.length} objects`);

    for (let i = 0; i < objects.length; i += CONCURRENCY) {
      const slice = objects.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async ({ key, size }) => {
          const target = path.join(storageDir, bucket.name, key);
          try {
            const existing = await stat(target).catch(() => null);
            if (existing && size > 0 && existing.size === size) {
              skipped += 1;
              return;
            }
            const { data, error } = await admin.storage.from(bucket.name).download(key);
            if (error || !data) {
              failed += 1;
              console.warn(`  ! ${key}: ${error?.message ?? "no data"}`);
              return;
            }
            const buffer = Buffer.from(await data.arrayBuffer());
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, buffer);
            downloaded += 1;
            bytes += buffer.byteLength;
          } catch (error) {
            failed += 1;
            console.warn(`  ! ${key}: ${error instanceof Error ? error.message : error}`);
          }
        }),
      );
    }
  }

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`\n✓ ${downloaded} downloaded (${mb} MB), ${skipped} already present, ${failed} failed`);
  console.log(`  ${storageDir}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
