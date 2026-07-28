/**
 * Copy news images that still point at a remote host into Mazora's own storage.
 *
 * Discord attachment links are signed and expire within about a day, so any
 * article still holding a cdn.discordapp.com URL will 404 shortly. This copies
 * the bytes into the `news-images` bucket under a key derived from the Discord
 * message id (matching the importer), then rewrites the article to the permanent
 * URL. Safe to re-run: already-migrated rows are skipped.
 *
 * Usage: npm run db:rehost:news-images
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "news-images";
const MAX_BYTES = 8 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function detectMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 6 && String.fromCharCode(...b.slice(0, 6)).startsWith("GIF8")) return "image/gif";
  return null;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!dbUrl || !supabaseUrl || !serviceKey) {
    console.error("Need DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const ownOrigin = new URL(supabaseUrl).origin;

  // Ensure the bucket exists before the first upload.
  const { data: bucket } = await admin.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: Object.keys(MIME_EXT),
    });
    if (error && !/already exists/i.test(error.message)) {
      console.error("Could not create bucket:", error.message);
      process.exit(1);
    }
    console.log(`created bucket ${BUCKET}`);
  }

  const sql = postgres(dbUrl, { prepare: false });
  let migrated = 0, skipped = 0, failed = 0;
  try {
    const rows = await sql<{ id: string; title: string; featured_image: string; discord_message_id: string | null }[]>`
      select id, title, featured_image, discord_message_id
      from public.news_articles
      where featured_image is not null`;

    console.log(`articles with an image: ${rows.length}\n`);

    for (const row of rows) {
      const label = row.title.slice(0, 38);
      if (row.featured_image.startsWith(ownOrigin)) {
        skipped += 1;
        continue; // already ours
      }
      try {
        const res = await fetch(row.featured_image, {
          signal: AbortSignal.timeout(20_000),
          headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
        });
        if (!res.ok) {
          console.log(`  FAILED  ${label} -> HTTP ${res.status}${res.status === 404 ? " (link already expired)" : ""}`);
          failed += 1;
          continue;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        const mime = detectMime(bytes);
        if (!mime || bytes.byteLength > MAX_BYTES) {
          console.log(`  FAILED  ${label} -> not a usable image`);
          failed += 1;
          continue;
        }

        const base = row.discord_message_id ? `discord/${row.discord_message_id}` : `custom/${row.id}`;
        const key = `${base}.${MIME_EXT[mime]}`;
        const { error: upErr } = await admin.storage.from(BUCKET).upload(key, bytes, {
          contentType: mime,
          cacheControl: "31536000",
          upsert: true,
        });
        if (upErr) {
          console.log(`  FAILED  ${label} -> upload: ${upErr.message}`);
          failed += 1;
          continue;
        }

        const publicUrl = admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
        await sql`update public.news_articles set featured_image = ${publicUrl} where id = ${row.id}`;
        console.log(`  ok      ${label} -> ${key}`);
        migrated += 1;
      } catch (err) {
        console.log(`  FAILED  ${label} -> ${err instanceof Error ? err.message : String(err)}`);
        failed += 1;
      }
    }

    console.log(`\nmigrated ${migrated}, already local ${skipped}, failed ${failed}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
