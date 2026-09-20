import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { SOCIAL_PLATFORM_KEYS, type CreatorSocial } from "@/lib/creator-socials";
import { resolveYouTubeProfileImage } from "@/lib/youtube-profile";
import { reportDatabaseReadFailure } from "@/lib/db/errors";

export interface ContentCreator {
  id: string;
  name: string;
  profileImageUrl: string | null;
  bio: string | null;
  socials: CreatorSocial[];
  publicVisible: boolean;
  featuredOnHome: boolean;
  createdAt: string;
}

function safeSocials(value: unknown): CreatorSocial[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as { platform?: unknown; url?: unknown };
    if (typeof entry.platform !== "string" || typeof entry.url !== "string") return [];
    if (!SOCIAL_PLATFORM_KEYS.includes(entry.platform as CreatorSocial["platform"])) return [];
    return [{ platform: entry.platform as CreatorSocial["platform"], url: entry.url }];
  });
}

function mapCreator(row: typeof schema.contentCreators.$inferSelect): ContentCreator {
  return {
    id: row.id,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    bio: row.bio,
    socials: safeSocials(row.socials),
    publicVisible: row.publicVisible,
    featuredOnHome: row.featuredOnHome,
    createdAt: row.createdAt.toISOString(),
  };
}

async function withResolvedProfileImage(creator: ContentCreator): Promise<ContentCreator> {
  if (creator.profileImageUrl) return creator;
  const youtube = creator.socials.find((social) => social.platform === "youtube");
  if (!youtube) return creator;
  const profileImageUrl = await resolveYouTubeProfileImage(youtube.url);
  return profileImageUrl ? { ...creator, profileImageUrl } : creator;
}

export async function getContentCreators(): Promise<ContentCreator[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.contentCreators)
      .orderBy(desc(schema.contentCreators.createdAt));
    return Promise.all(rows.map(mapCreator).map(withResolvedProfileImage));
  } catch (error) {
    reportDatabaseReadFailure("Failed to load content creators", error);
    return [];
  }
}

export async function getPublicContentCreators({
  featuredOnly = false,
  limit,
}: { featuredOnly?: boolean; limit?: number } = {}): Promise<ContentCreator[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const where = featuredOnly
      ? and(
          eq(schema.contentCreators.publicVisible, true),
          eq(schema.contentCreators.featuredOnHome, true),
        )
      : eq(schema.contentCreators.publicVisible, true);
    const query = db
      .select()
      .from(schema.contentCreators)
      .where(where)
      .orderBy(desc(schema.contentCreators.createdAt));
    const rows = limit ? await query.limit(limit) : await query;
    return Promise.all(rows.map(mapCreator).map(withResolvedProfileImage));
  } catch (error) {
    reportDatabaseReadFailure("Failed to load public content creators", error);
    return [];
  }
}
