import { getDb, schema } from "@/lib/db/client";
import type { PatchUpdate } from "@/lib/types";
import { eq, desc } from "drizzle-orm";
import {
  fetchChannelMessages,
  fetchGuildRoles,
  getDiscordBotToken,
  getDiscordGuildId,
  type DiscordMessage,
  type DiscordRole,
} from "@/lib/discord";
import { profilesByBylineName } from "@/lib/data/content";

function discordAvatarUrl(message: DiscordMessage, guildId?: string | null): string | undefined {
  const userId = message.author?.id;
  if (!userId) return undefined;
  if (guildId && message.member?.avatar) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${message.member.avatar}.webp?size=128`;
  }
  if (message.author.avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${message.author.avatar}.webp?size=128`;
  }
  try {
    const defaultIndex = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  } catch {
    return undefined;
  }
}

function discordRoleLabel(message: DiscordMessage, roles: DiscordRole[]): string {
  const roleIds = new Set(message.member?.roles ?? []);
  const highestRole = roles
    .filter((role) => role.name !== "@everyone" && roleIds.has(role.id))
    .sort((a, b) => b.position - a.position)[0];
  return highestRole?.name || (message.author.bot ? "Discord Bot" : "Owner");
}

/** Remove Discord Markdown fences without losing text placed beside a fence. */
function cleanDiscordPatchLine(line: string): string {
  return line
    .trim()
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
}

function profileRoleLabel(role?: string | null): string | undefined {
  if (!role) return undefined;
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function enrichPatchAuthors(
  patches: PatchUpdate[],
  preferWebsiteProfile = false,
): Promise<PatchUpdate[]> {
  const profiles = await profilesByBylineName(patches.map((patch) => patch.author));
  return patches.map((patch) => {
    const profile = profiles.get(patch.author.trim().toLowerCase());
    if (!profile) return patch;
    return {
      ...patch,
      author: preferWebsiteProfile ? (profile.displayName || profile.username) : patch.author,
      authorAvatar: preferWebsiteProfile
        ? (profile.avatarUrl ?? patch.authorAvatar)
        : (patch.authorAvatar ?? profile.avatarUrl ?? undefined),
      authorRole: preferWebsiteProfile
        ? (profileRoleLabel(profile.role) ?? patch.authorRole)
        : patch.authorRole,
    };
  });
}

/** Fallback patch updates imported from Discord #PATCH-UPDATE channel */
const DISCORD_PATCH_UPDATES: PatchUpdate[] = [
  {
    id: "patch-1-15",
    version: "Patch Update 1.15",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-26T20:49:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: [
      "Clearlag added with optimizations",
      "Playtime tracker added /playtime",
      "You can now sell wheat",
    ],
    discordChannel: "#PATCH-UPDATE",
  },
  {
    id: "patch-1-14",
    version: "Patch Update 1.14",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-22T02:34:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: ["Orders System Added"],
    discordChannel: "#PATCH-UPDATE",
  },
  {
    id: "patch-1-13",
    version: "Patch Update 1.13",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-14T15:15:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: [
      "Teleporting cool down = 20seconds",
      "Teleport delay = 3 seconds",
      "/heal commad cool down = 1 hour",
      "Delay time between chat messages = 3 seconds",
      "New server text colors and /msg format",
    ],
    discordChannel: "#PATCH-UPDATE",
  },
  {
    id: "patch-1-12",
    version: "Patch Update 1.12",
    targetMode: "Survival - 1.21.11",
    date: "2026-07-05T12:00:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: [
      "Nether World expansion & spawn safety zone",
      "Custom Enchants balancing & bug fixes",
      "Daily Vote Rewards doubled for top voters",
    ],
    discordChannel: "#PATCH-UPDATE",
  },
  {
    id: "patch-1-11",
    version: "Patch Update 1.11",
    targetMode: "Survival - 1.21.11",
    date: "2026-06-28T18:30:00Z",
    author: "LilyLuvv",
    authorRole: "Owner",
    changes: [
      "Auction House added /ah for player trading",
      "Bedrock crossplay protocol update to latest version",
      "Economy balance adjustments & shop updates",
    ],
    discordChannel: "#PATCH-UPDATE",
  },
];

export async function getPatchUpdates(customChannelId?: string): Promise<PatchUpdate[]> {
  const token = getDiscordBotToken();
  const channelId =
    customChannelId ||
    process.env.DISCORD_PATCH_CHANNEL_ID ||
    process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID ||
    "1193207365906997379";

  if (token && channelId) {
    try {
      const guildId = getDiscordGuildId();
      // 300s matches the other upstream feeds (server status, Discord stats).
      // Without it this Discord round trip ran on every /play render.
      const [messages, guildRoles] = await Promise.all([
        fetchChannelMessages(token, channelId, undefined, 30, 300),
        guildId ? fetchGuildRoles(token, guildId, 300) : Promise.resolve(null),
      ]);
      if (messages && Array.isArray(messages) && messages.length > 0) {
        const livePatches: PatchUpdate[] = [];

        for (const msg of messages) {
          const rawContent = msg.content || "";
          const lines = rawContent
            .split("\n")
            .map(cleanDiscordPatchLine)
            .filter(Boolean);
          if (lines.length === 0) continue;

          const lowerRaw = rawContent.toLowerCase();
          const isExplicitPatch =
            lowerRaw.includes("patch") ||
            lowerRaw.includes("changelog") ||
            (lowerRaw.includes("update") &&
              !lowerRaw.includes("birthday") &&
              !lowerRaw.includes("happy birthday") &&
              !lowerRaw.includes("event"));

          // Skip general announcements (e.g. birthday wishes) unless explicitly querying a dedicated channel or post contains patch keywords
          if (!isExplicitPatch && !customChannelId) {
            continue;
          }

          // Find version line (e.g. "⭐ Patch Update 1.15" or "Patch Update 1.15")
          const versionLine =
            lines.find((l) => {
              const low = l.toLowerCase();
              return low.includes("patch") || low.includes("changelog") || (low.includes("update") && !low.includes("birthday"));
            }) || (isExplicitPatch ? lines[0] : null);

          if (!versionLine) continue;

          const cleanVersion = versionLine.replace(/^[*_#~>⭐\s]+/, "").trim();
          if (cleanVersion.toLowerCase().includes("birthday") || cleanVersion.toLowerCase().includes("happy birthday")) {
            continue;
          }

          // Find target mode (e.g. "Survival - 1.21.11")
          const modeLine =
            lines.find((l) => l.toLowerCase().includes("survival") || l.includes("1.21")) || "Survival - 1.21.11";

          // Extract changes / bullet points
          const changeLines = lines
            .filter((l) => l !== versionLine && l !== modeLine && !l.includes("@everyone") && !l.includes("@here"))
            .map((l) => l.replace(/^[-*•]\s*/, ""));

          const author = msg.member?.nick || msg.author.global_name || msg.author.username || "LilyLuvv";

          livePatches.push({
            id: msg.id,
            version: cleanVersion || `Patch Update ${msg.id.slice(-4)}`,
            targetMode: modeLine,
            date: msg.timestamp,
            author,
            authorRole: discordRoleLabel(msg, guildRoles ?? []),
            authorAvatar: discordAvatarUrl(msg, guildId),
            changes: changeLines.length > 0 ? changeLines : [rawContent.slice(0, 150)],
            discordChannel: "#PATCH-UPDATE",
          });
        }

        if (livePatches.length > 0) {
          return enrichPatchAuthors(livePatches);
        }
      }
    } catch (err) {
      console.error(`Failed to query live Discord patch updates for channel ${channelId}:`, err);
    }
  }

  // Check database if Discord sync is stored
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.newsArticles)
        .where(eq(schema.newsArticles.category, "Patch Notes"))
        .orderBy(desc(schema.newsArticles.publishedAt));

      if (rows.length > 0) {
        const storedPatches = rows.map((r) => {
          const lines = (r.content ?? "")
            .split("\n")
            .map(cleanDiscordPatchLine)
            .filter(Boolean);
          const targetMode = lines.find((l) => l.includes("Survival") || l.includes("Mode")) || "Survival - 1.21.11";
          const changes = lines.filter((l) => l.startsWith("-") || l.startsWith("*")).map((l) => l.replace(/^[-*]\s*/, ""));

          return {
            id: r.id,
            version: r.title,
            targetMode,
            date: (r.publishedAt ?? r.createdAt).toISOString(),
            author: r.authorName || r.discordAuthor || "LilyLuvv",
            authorRole: r.authorRole || r.discordAuthorRole || "Owner",
            authorAvatar: r.authorAvatarUrl || r.discordAuthorAvatarUrl || undefined,
            changes: changes.length > 0 ? changes : [r.excerpt || r.title],
            discordChannel: "#PATCH-UPDATE",
          };
        });
        return enrichPatchAuthors(storedPatches, true);
      }
    } catch {
      // Fallback below
    }
  }

  return enrichPatchAuthors(DISCORD_PATCH_UPDATES, true);
}
