/**
 * Clear all dummy/seed data from the gallery_images and gallery_likes tables.
 * Usage: npx tsx scripts/clear-gallery.ts
 */
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set in .env.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false });

  try {
    // Count before clearing
    const [{ count: likesBefore }] = await sql`SELECT count(*)::int as count FROM gallery_likes`;
    const [{ count: imagesBefore }] = await sql`SELECT count(*)::int as count FROM gallery_images`;

    console.log(`Found ${imagesBefore} gallery images and ${likesBefore} likes.`);

    if (imagesBefore === 0) {
      console.log("Gallery is already empty. Nothing to clear.");
      return;
    }

    // Clear likes first (FK constraint), then images
    await sql`DELETE FROM gallery_likes`;
    await sql`DELETE FROM gallery_images`;

    console.log(`✓ Cleared ${imagesBefore} gallery images and ${likesBefore} likes.`);
    console.log("Gallery is now empty and ready for real community uploads.");
  } catch (err) {
    console.error("Failed to clear gallery data:");
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
