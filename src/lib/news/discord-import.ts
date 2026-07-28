import "server-only";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import type { DiscordMessage, DiscordRole } from "@/lib/discord";
import {
  fetchChannelMessage,
  fetchChannelMessages,
  fetchGuildRoles,
  getAnnouncementsChannelId,
  getDiscordBotToken,
  getDiscordGuildId,
} from "@/lib/discord";
import { getDb, schema } from "@/lib/db/client";
import { discordOriginalKey, rehostImageFromUrl } from "@/lib/news/image-store";

export interface MappedArticle {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string | null;
  discordMessageId: string;
  discordAuthor: string;
  discordAuthorRole: string;
  discordAuthorAvatarUrl: string | null;
}

/** Discord message types that carry real user content. 0 = default, 19 = reply. */
const CONTENT_TYPES = new Set([0, 19]);

/** Attachments are only trusted from Discord's own CDN. */
// Only hosts that next.config.ts allows in both images.remotePatterns and the CSP
// img-src belong here — anything else would be stored and then blocked at render.
const IMAGE_HOSTS = new Set(["cdn.discordapp.com"]);

export function safeDiscordImage(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && IMAGE_HOSTS.has(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Strip the markdown Discord authors commonly use in headings. */
function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,3}\s+/, "")
    .replace(/[*_~`>]/g, "")
    .trim();
}

/**
 * True when a line is nothing but pings — `@everyone`, `@here`, a role or user
 * mention. Announcements very often open with one, and using it as the headline
 * produced articles literally titled "@everyone".
 */
function isMentionOnly(line: string): boolean {
  const withoutMentions = line
    .replace(/@everyone|@here/gi, "")
    .replace(/<@[!&]?\d+>/g, "")
    .replace(/<#\d+>/g, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
  return withoutMentions.length === 0;
}

/** Slug from the title plus a short seed, so two same-titled posts never collide. */
export function slugifyTitle(title: string, seed: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = seed.replace(/\D/g, "").slice(-6) || "000000";
  return `${base || "announcement"}-${suffix}`;
}

/**
 * Turn one Discord message into an article draft. Returns null for messages that
 * carry no publishable content — system messages, and posts that are neither text
 * nor image.
 */
function discordAvatarUrl(message: DiscordMessage, guildId?: string | null): string | null {
  const userId = message.author?.id;
  if (!userId) return null;
  const guildAvatar = message.member?.avatar;
  if (guildId && guildAvatar) {
    return "https://cdn.discordapp.com/guilds/" + guildId + "/users/" + userId + "/avatars/" + guildAvatar + ".webp?size=128";
  }
  const avatar = message.author?.avatar;
  if (avatar) return "https://cdn.discordapp.com/avatars/" + userId + "/" + avatar + ".webp?size=128";
  try {
    const defaultIndex = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
    return "https://cdn.discordapp.com/embed/avatars/" + defaultIndex + ".png";
  } catch {
    return null;
  }
}

function discordRoleLabel(message: DiscordMessage, roles: DiscordRole[] = []): string {
  const roleIds = new Set(message.member?.roles ?? []);
  const role = roles
    .filter((candidate) => candidate.name !== "@everyone" && roleIds.has(candidate.id))
    .sort((a, b) => b.position - a.position)[0];
  return role?.name || (message.author?.bot ? "Discord Bot" : "Community Member");
}

export function mapDiscordMessage(
  message: DiscordMessage,
  roles: DiscordRole[] = [],
  guildId?: string | null,
): MappedArticle | null {
  // The dedup index is partial (`where discord_message_id is not null`), so a row
  // stored with a NULL id would fall outside it and be re-imported on every sync
  // forever. The Discord response is only cast, never validated, so check the
  // snowflake here before anything else.
  if (!/^\d{17,20}$/.test(message.id ?? "")) return null;
  if (!CONTENT_TYPES.has(message.type)) return null;

  const image = safeDiscordImage(message.attachments?.[0]?.url);
  const lines = (message.content ?? "").split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length === 0 && !image) return null;

  // Announcements usually open with an @everyone ping. Skip those lines when
  // picking the headline, or the article ends up titled "@everyone".
  const titleIndex = nonEmpty.findIndex((line) => !isMentionOnly(line));
  const headline = titleIndex === -1 ? "" : nonEmpty[titleIndex];
  const title = stripMarkdown(headline || "Announcement").slice(0, 160) || "Announcement";
  const content = nonEmpty
    .slice(titleIndex === -1 ? 0 : titleIndex + 1)
    .filter((line) => !isMentionOnly(line))
    .join("\n\n")
    .trim();
  const excerpt = (content || title).slice(0, 200);

  return {
    title,
    slug: slugifyTitle(title, message.id),
    excerpt,
    content,
    featuredImage: image,
    discordMessageId: message.id,
    discordAuthor: message.member?.nick || message.author?.global_name || message.author?.username || "Discord",
    discordAuthorRole: discordRoleLabel(message, roles),
    discordAuthorAvatarUrl: discordAvatarUrl(message, guildId),
  };
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  message: string;
}

/** At most this many messages per run, so a backlog cannot cause a runaway import. */
const MAX_PER_RUN = 25;

export async function importDiscordAnnouncements(): Promise<ImportResult> {
  const token = getDiscordBotToken();
  const channelId = getAnnouncementsChannelId();
  const guildId = getDiscordGuildId();
  if (!token || !channelId) {
    return { ok: false, imported: 0, skipped: 0, message: "Discord announcement sync is not configured." };
  }

  const db = getDb();
  if (!db) return { ok: false, imported: 0, skipped: 0, message: "The database is not connected." };

  // Resume after the newest message already imported. `discordMessageId` is a text
  // column, so this ORDER BY is a lexicographic (string) comparison over Discord
  // snowflakes, not a numeric one. That only yields the correct "newest" row because
  // every snowflake used here is 19 digits long; mixing in pre-2022 18-digit ids would
  // sort before all 19-digit ones and pick the wrong cursor. Do not reuse this pattern
  // against ids of mixed length.
  // Guarded: if migration 009 has not been applied the column does not exist and
  // Postgres throws, which would otherwise escape as an unhandled rejection.
  let cursor: string | undefined;
  try {
    const [latest] = await db
      .select({ id: schema.newsArticles.discordMessageId })
      .from(schema.newsArticles)
      .where(isNotNull(schema.newsArticles.discordMessageId))
      .orderBy(desc(schema.newsArticles.discordMessageId))
      .limit(1);
    cursor = latest?.id ?? undefined;
  } catch (error) {
    console.error("Discord news cursor lookup failed", error);
    return { ok: false, imported: 0, skipped: 0, message: "The database is not available." };
  }

  const [messages, guildRoles] = await Promise.all([
    fetchChannelMessages(token, channelId, cursor, MAX_PER_RUN),
    guildId ? fetchGuildRoles(token, guildId) : Promise.resolve(null),
  ]);
  if (messages === null) {
    return { ok: false, imported: 0, skipped: 0, message: "Discord did not respond. Try again shortly." };
  }

  let imported = 0;
  let skipped = 0;
  let refreshed = 0;

  // Migration 010 can preserve the legacy Discord name, but old rows predate role
  // and avatar capture. Refresh a bounded batch during a normal sync so the admin
  // review queue gradually gains the complete original-poster identity without
  // changing a public byline that an editor has customized.
  try {
    const legacyPublishers = await db
      .select({
        id: schema.newsArticles.id,
        messageId: schema.newsArticles.discordMessageId,
        publisherMode: schema.newsArticles.publisherMode,
        authorName: schema.newsArticles.authorName,
        authorRole: schema.newsArticles.authorRole,
        authorAvatarUrl: schema.newsArticles.authorAvatarUrl,
      })
      .from(schema.newsArticles)
      .where(and(
        eq(schema.newsArticles.source, "discord"),
        isNotNull(schema.newsArticles.discordMessageId),
        or(
          isNull(schema.newsArticles.discordAuthorRole),
          eq(schema.newsArticles.discordAuthorRole, "Discord Publisher"),
          isNull(schema.newsArticles.discordAuthorAvatarUrl),
        ),
      ))
      .orderBy(desc(schema.newsArticles.createdAt))
      .limit(MAX_PER_RUN);

    for (const row of legacyPublishers) {
      if (!row.messageId) continue;
      const original = await fetchChannelMessage(token, channelId, row.messageId);
      const mapped = original ? mapDiscordMessage(original, guildRoles ?? [], guildId) : null;
      if (!mapped) continue;

      await db
        .update(schema.newsArticles)
        .set({
          discordAuthor: mapped.discordAuthor,
          discordAuthorRole: mapped.discordAuthorRole,
          discordAuthorAvatarUrl: mapped.discordAuthorAvatarUrl,
          ...(row.publisherMode === "author" ? {
            authorName: row.authorName || mapped.discordAuthor,
            authorRole: !row.authorRole || row.authorRole === "Discord Publisher"
              ? mapped.discordAuthorRole
              : row.authorRole,
            authorAvatarUrl: row.authorAvatarUrl || mapped.discordAuthorAvatarUrl,
          } : {}),
        })
        .where(eq(schema.newsArticles.id, row.id));
      refreshed += 1;
    }
  } catch (error) {
    // Identity enrichment is best-effort; it must never block new announcements.
    console.error("Discord publisher identity refresh failed", error);
  }

  // Oldest first so the newest ends up last and reads naturally in the queue.
  for (const message of [...messages].reverse()) {
    try {
      const mapped = mapDiscordMessage(message, guildRoles ?? [], guildId);
      if (!mapped) { skipped += 1; continue; }

      // Discord attachment links are signed and expire within about a day, so
      // the artwork is copied into our own bucket under a key derived from the
      // message id. That URL is permanent and lets staff restore the original
      // later even if they replace or remove the article's image.
      let storedImage: string | null = null;
      if (mapped.featuredImage) {
        const hosted = await rehostImageFromUrl(
          mapped.featuredImage,
          discordOriginalKey(mapped.discordMessageId),
        );
        storedImage = hosted?.url ?? null;
      }

      const rows = await db
        .insert(schema.newsArticles)
        .values({
          title: mapped.title,
          slug: mapped.slug,
          excerpt: mapped.excerpt,
          content: mapped.content,
          featuredImage: storedImage,
          category: "Announcements",
          status: "pending",
          authorName: mapped.discordAuthor,
          authorRole: mapped.discordAuthorRole,
          authorAvatarUrl: mapped.discordAuthorAvatarUrl,
          publisherMode: "author",
          discordAuthor: mapped.discordAuthor,
          discordAuthorRole: mapped.discordAuthorRole,
          discordAuthorAvatarUrl: mapped.discordAuthorAvatarUrl,
          discordMessageId: mapped.discordMessageId,
          source: "discord",
          publishedAt: null,
        })
        .onConflictDoNothing()
        .returning({ id: schema.newsArticles.id });
      if (rows.length > 0) imported += 1;
      else skipped += 1;
    } catch {
      // One bad row must not abort the run.
      skipped += 1;
    }
  }

  return {
    ok: true,
    imported,
    skipped,
    message: [
      imported === 0 ? "No new announcements." : `Imported ${imported} announcement${imported === 1 ? "" : "s"}.`,
      refreshed > 0 ? `Refreshed ${refreshed} Discord publisher identit${refreshed === 1 ? "y" : "ies"}.` : "",
    ].filter(Boolean).join(" "),
  };
}
