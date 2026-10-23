import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { isValidSocialUrl, SOCIAL_PLATFORM_KEYS, type CreatorSocial } from "@/lib/creator-socials";
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

/** Creators the admin board reads, and the most a public list reads. Neither page paginates. */
const ADMIN_CREATORS_LIMIT = 500;
const PUBLIC_CREATORS_LIMIT = 100;

/**
 * Socials as stored, re-checked on the way out. The save action validates
 * them, but these become hrefs on public pages, so a row written before that
 * check (or by hand) must not carry a javascript: or http: link through.
 */
function safeSocials(value: unknown): CreatorSocial[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as { platform?: unknown; url?: unknown };
    if (typeof entry.platform !== "string" || typeof entry.url !== "string") return [];
    if (!SOCIAL_PLATFORM_KEYS.includes(entry.platform as CreatorSocial["platform"])) return [];
    if (!isValidSocialUrl(entry.url)) return [];
    return [{ platform: entry.platform as CreatorSocial["platform"], url: entry.url.trim() }];
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
      .orderBy(desc(schema.contentCreators.createdAt))
      .limit(ADMIN_CREATORS_LIMIT);
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
    const rows = await db
      .select()
      .from(schema.contentCreators)
      .where(where)
      .orderBy(desc(schema.contentCreators.createdAt))
      .limit(Math.min(limit ?? PUBLIC_CREATORS_LIMIT, PUBLIC_CREATORS_LIMIT));
    return Promise.all(rows.map(mapCreator).map(withResolvedProfileImage));
  } catch (error) {
    reportDatabaseReadFailure("Failed to load public content creators", error);
    return [];
  }
}
