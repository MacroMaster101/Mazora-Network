import "server-only";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { rawSkinUrlForHead } from "@/lib/minecraft/skin";

/**
 * Public read side of `minecraft_accounts`. Only the fields a public directory
 * may show are selected: the IGN, the skin URLs, and when the link was made.
 * The auth user id never leaves this module.
 *
 * Only active accounts are listed: a suspended, deleted or unconfirmed
 * account's Minecraft name and skin stay off the public player list, as its
 * site account does (publicDirectoryAccounts).
 */
export interface LinkedAccount {
  username: string;
  headUrl: string | null;
  rawSkinUrl: string | null;
  linkedAt: string;
}

export const listLinkedAccounts = cache(async (): Promise<LinkedAccount[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        username: schema.minecraftAccounts.minecraftUsername,
        headUrl: schema.minecraftAccounts.skinHeadUrl,
        rawSkinUrl: schema.minecraftAccounts.rawSkinUrl,
        linkedAt: schema.minecraftAccounts.linkedAt,
      })
      .from(schema.minecraftAccounts)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.minecraftAccounts.userId))
      .where(eq(schema.profiles.accountStatus, "active"));

    return rows.map((row) => {
      let linkedAtStr: string;
      try {
        const d = row.linkedAt instanceof Date ? row.linkedAt : new Date(row.linkedAt);
        linkedAtStr = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch {
        linkedAtStr = new Date().toISOString();
      }

      return {
        username: row.username,
        headUrl: row.headUrl,
        rawSkinUrl: row.rawSkinUrl,
        linkedAt: linkedAtStr,
      };
    });
  } catch (error) {
    console.error("Failed to list linked Minecraft accounts:", error);
    return [];
  }
});

/** The skin URLs for one IGN, matched case-insensitively as usernames are. */
export async function getLinkedSkin(
  username: string,
): Promise<{ rawSkinUrl: string | null; headUrl: string | null } | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db
      .select({
        rawSkinUrl: schema.minecraftAccounts.rawSkinUrl,
        headUrl: schema.minecraftAccounts.skinHeadUrl,
      })
      .from(schema.minecraftAccounts)
      .where(sql`lower(${schema.minecraftAccounts.minecraftUsername}) = lower(${username})`)
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to read a linked Minecraft skin:", error);
    return null;
  }
}

/**
 * The uploaded skin to draw a body from for this name, for the body route.
 *
 * The linked account's raw file first. When there is no raw_skin_url on record
 * (no linked Minecraft account, or a row from before raw files were kept), the
 * raw file uploaded beside the head (rawSkinUrlForHead): the head comes from
 * the linked account, or else from the site account's profile picture, which is
 * where a skin stays after the Minecraft account is unlinked. Without this the
 * head showed the uploaded skin while the body showed Mojang's or Steve.
 *
 * Only URL shapes are derived here; the route still checks the origin before
 * fetching anything.
 */
export async function getUploadedSkin(username: string): Promise<{ rawSkinUrl: string | null } | null> {
  const linked = await getLinkedSkin(username);
  const fromLinked = linked?.rawSkinUrl ?? rawSkinUrlForHead(linked?.headUrl);
  if (fromLinked) return { rawSkinUrl: fromLinked };

  const db = getDb();
  if (!db) return null;
  try {
    const [profile] = await db
      .select({ avatarUrl: schema.profiles.avatarUrl })
      .from(schema.profiles)
      .where(sql`lower(${schema.profiles.username}) = lower(${username})`)
      .limit(1);
    const raw = rawSkinUrlForHead(profile?.avatarUrl);
    return raw ? { rawSkinUrl: raw } : null;
  } catch (error) {
    console.error("Failed to read a profile skin:", error);
    return null;
  }
}
