import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { SuggestionImage } from "@/lib/data/suggestions-board";

export interface AdminSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  status: "open" | "under_review" | "planned" | "completed" | "declined";
  createdAt: string;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  votesCount: number;
  locked: boolean;
  /** Attachments, so staff can review them without opening the public thread. */
  images: SuggestionImage[];
}

/**
 * Attachments for a set of suggestions or replies, in one query, keyed by
 * target id. Staff triage images from inside the admin screens, so both admin
 * readers need them; doing it per row would be an N+1 on every page load.
 */
async function imagesFor(
  db: NonNullable<ReturnType<typeof getDb>>,
  column: typeof schema.suggestionImages.suggestionId | typeof schema.suggestionImages.replyId,
  ids: string[],
): Promise<Map<string, SuggestionImage[]>> {
  const byId = new Map<string, SuggestionImage[]>();
  if (!ids.length) return byId;
  try {
    const rows = await db
      .select({
        id: schema.suggestionImages.id,
        url: schema.suggestionImages.url,
        sortOrder: schema.suggestionImages.sortOrder,
        target: column,
      })
      .from(schema.suggestionImages)
      .where(inArray(column, ids))
      .orderBy(asc(schema.suggestionImages.sortOrder));
    for (const row of rows) {
      const key = row.target as string;
      const list = byId.get(key) ?? [];
      list.push({ id: row.id, url: row.url, sortOrder: row.sortOrder });
      byId.set(key, list);
    }
  } catch (error) {
    // Best effort: a thumbnail strip is not worth failing a moderation screen.
    console.error("Failed to load suggestion images for admin", error);
  }
  return byId;
}

export async function getAdminSuggestions(): Promise<AdminSuggestion[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        id: schema.suggestions.id,
        title: schema.suggestions.title,
        category: schema.suggestions.category,
        description: schema.suggestions.description,
        status: schema.suggestions.status,
        createdAt: schema.suggestions.createdAt,
        authorUsername: schema.profiles.username,
        authorDisplayName: schema.profiles.displayName,
        authorAvatarUrl: schema.profiles.avatarUrl,
        votesCount: sql<number>`cast(count(${schema.suggestionVotes.id}) as integer)`,
        locked: schema.suggestions.locked,
      })
      .from(schema.suggestions)
      .leftJoin(schema.profiles, eq(schema.suggestions.userId, schema.profiles.userId))
      .leftJoin(schema.suggestionVotes, eq(schema.suggestions.id, schema.suggestionVotes.suggestionId))
      .groupBy(
        schema.suggestions.id,
        schema.suggestions.title,
        schema.suggestions.category,
        schema.suggestions.description,
        schema.suggestions.status,
        schema.suggestions.createdAt,
        schema.profiles.username,
        schema.profiles.displayName,
        schema.profiles.avatarUrl,
        schema.suggestions.locked,
      )
      .orderBy(desc(schema.suggestions.createdAt));

    const images = await imagesFor(db, schema.suggestionImages.suggestionId, rows.map((r) => r.id));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category || "Gameplay",
      description: r.description,
      status: (r.status as AdminSuggestion["status"]) || "open",
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      authorUsername: r.authorUsername || "community_member",
      authorDisplayName: r.authorDisplayName || null,
      authorAvatarUrl: r.authorAvatarUrl || null,
      votesCount: Number(r.votesCount) || 0,
      locked: Boolean(r.locked),
      images: images.get(r.id) ?? [],
    }));
  } catch (error) {
    console.error("Failed to load admin suggestions", error);
    return [];
  }
}

export interface AdminReply {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  images: SuggestionImage[];
}

/**
 * Every reply in a thread, oldest first, including soft-deleted ones — staff
 * need to see what was removed, not just what remains. Mirrors the reply
 * query in getSuggestionThread (src/lib/data/suggestions-board.ts), which is
 * likewise never filtered by deletedAt.
 */
export async function getSuggestionRepliesForAdmin(suggestionId: string): Promise<AdminReply[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        id: schema.suggestionReplies.id,
        body: schema.suggestionReplies.body,
        createdAt: schema.suggestionReplies.createdAt,
        editedAt: schema.suggestionReplies.editedAt,
        deletedAt: schema.suggestionReplies.deletedAt,
        authorUsername: schema.profiles.username,
        authorDisplayName: schema.profiles.displayName,
        authorAvatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.suggestionReplies)
      .leftJoin(schema.profiles, eq(schema.suggestionReplies.userId, schema.profiles.userId))
      .where(eq(schema.suggestionReplies.suggestionId, suggestionId))
      .orderBy(asc(schema.suggestionReplies.createdAt));

    const replyImages = await imagesFor(db, schema.suggestionImages.replyId, rows.map((r) => r.id));

    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      editedAt: r.editedAt instanceof Date ? r.editedAt.toISOString() : r.editedAt ? String(r.editedAt) : null,
      deletedAt: r.deletedAt instanceof Date ? r.deletedAt.toISOString() : r.deletedAt ? String(r.deletedAt) : null,
      authorUsername: r.authorUsername || "community_member",
      authorDisplayName: r.authorDisplayName || null,
      authorAvatarUrl: r.authorAvatarUrl || null,
      images: replyImages.get(r.id) ?? [],
    }));
  } catch (error) {
    console.error("Failed to load suggestion replies for admin", error);
    return [];
  }
}
