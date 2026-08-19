import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

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
      )
      .orderBy(desc(schema.suggestions.createdAt));

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
    }));
  } catch (error) {
    console.error("Failed to load admin suggestions", error);
    return [];
  }
}
