import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

/**
 * Public read side of `minecraft_accounts`. Only the fields a public directory
 * may show are selected: the IGN, the skin URLs, and when the link was made.
 * The auth user id never leaves this module.
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
      .from(schema.minecraftAccounts);

    return rows.map((row) => ({
      username: row.username,
      headUrl: row.headUrl,
      rawSkinUrl: row.rawSkinUrl,
      linkedAt: (row.linkedAt instanceof Date ? row.linkedAt : new Date(row.linkedAt)).toISOString(),
    }));
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
