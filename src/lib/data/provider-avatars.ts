import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { providerAvatar } from "@/lib/avatar-source";

/**
 * Sign-in provider photos for accounts that never chose a profile avatar.
 *
 * `profiles.avatar_url` holds only an avatar the member picked themselves — an
 * upload, a Minecraft head, or a Discord photo saved through our own actions.
 * Someone who signed in with Google or Discord and never opened profile
 * settings has it null, yet the header still shows their provider photo,
 * because `getSession` resolves through `resolveAvatarUrl` (chosen first,
 * provider second). A list that reads `profiles.avatar_url` alone therefore
 * renders a monogram for the very same person the header renders a photo for.
 * This supplies the second half of that resolution for list readers, in one
 * query for the whole page rather than one per row.
 *
 * `providerAvatar` host-allowlists the URL, so a member cannot get an arbitrary
 * image rendered by editing their own user metadata.
 *
 * Best-effort by design: a monogram is an acceptable fallback, but a failure
 * here must never take down a board or a thread.
 */
export async function providerAvatarsFor(
  userIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return found;

  const db = getDb();
  if (!db) return found;

  try {
    // Drizzle's `sql` template expands a JS array into one parameter PER item,
    // so `= any(${ids})` compiles to the invalid `any($1, $2)`. Build the list
    // explicitly instead — still fully parameterised, one placeholder per id.
    const idList = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    const rows = (await db.execute(
      sql`select id::text as id, raw_user_meta_data as meta from auth.users where id::text in (${idList})`,
    )) as unknown as Array<{ id: string; meta: Record<string, unknown> | null }>;

    for (const row of rows ?? []) {
      const url = providerAvatar(row.meta);
      if (url) found.set(row.id, url);
    }
  } catch (error) {
    console.error("Provider avatar lookup failed", error);
  }

  return found;
}
