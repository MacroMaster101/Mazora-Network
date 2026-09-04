import "server-only";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { classifyBotVar } from "@/lib/bot-config";
import { getDb, schema } from "@/lib/db/client";
import { fetchChannel, getDiscordBotToken, getDiscordGuildId, listGuildRoles } from "@/lib/discord";
import { describeBotAuditRow } from "@/lib/bot-activity-labels";

/**
 * Readers for the /admin/mazora-bot console.
 *
 * Every function returns a discriminated result rather than throwing, so one
 * unreachable dependency degrades a single card instead of blanking the page.
 * Nothing here returns a secret: environment checks report verdicts only.
 */

export interface BotHealthFlags {
  tokenSet: boolean;
  keyOk: boolean;
  guildSet: boolean;
  appIdSet: boolean;
}

/**
 * The secret-presence checks the health panel shows as chips.
 *
 * This replaces the Configuration panel, which listed every DISCORD_* variable
 * by name. Only the verdict escapes this server-only module; no environment
 * value enters a component or a client bundle.
 */
export function readBotHealthFlags(): BotHealthFlags {
  return {
    tokenSet: classifyBotVar("text", process.env.DISCORD_BOT_TOKEN) === "set",
    keyOk: classifyBotVar("hex64", process.env.DISCORD_APP_PUBLIC_KEY) === "set",
    guildSet: classifyBotVar("text", process.env.DISCORD_GUILD_ID) === "set",
    appIdSet: classifyBotVar("text", process.env.DISCORD_APPLICATION_ID) === "set",
  };
}

export interface ChannelRoute {
  name: string;
  label: string;
  /** Discord channel name, or null when the channel could not be resolved. */
  resolved: string | null;
}

/**
 * Channel ids come exclusively from the environment. A caller-supplied id must
 * never reach here — with the bot token, that would read any channel the bot
 * can see, including order tickets. See api/discord/patches/route.ts.
 */
const ROUTED_CHANNELS: { name: string; label: string }[] = [
  { name: "DISCORD_ORDERS_CHANNEL_ID", label: "Store orders" },
  { name: "DISCORD_TICKET_LOGS_CHANNEL_ID", label: "Ticket logs" },
  { name: "DISCORD_BUYERS_CHANNEL_ID", label: "Buyers announcements" },
  { name: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID", label: "News source" },
  { name: "DISCORD_PATCH_CHANNEL_ID", label: "Patch notes source" },
];

export async function readChannelRoutes(): Promise<
  { ok: true; routes: ChannelRoute[] } | { ok: false; reason: string }
> {
  const token = getDiscordBotToken();
  if (!token) return { ok: false, reason: "DISCORD_BOT_TOKEN is not configured." };

  const configured = ROUTED_CHANNELS.map((entry) => ({
    ...entry,
    channelId: process.env[entry.name]?.trim() ?? "",
  })).filter((entry) => /^\d{17,20}$/.test(entry.channelId));

  if (configured.length === 0) return { ok: true, routes: [] };

  let routes: ChannelRoute[];
  try {
    routes = await Promise.all(
      configured.map(async (entry) => ({
        name: entry.name,
        label: entry.label,
        resolved: (await fetchChannel(token, entry.channelId))?.name ?? null,
      })),
    );
  } catch {
    // botRequest uses a raw fetch with AbortSignal.timeout and no catch of its
    // own, so a network failure or an abort rejects rather than returning a
    // falsy result. The reader's contract is that it never throws.
    return { ok: false, reason: "Discord did not respond." };
  }

  return { ok: true, routes };
}

export interface NewsSyncReport {
  channelConfigured: boolean;
  cronSchedule: string;
  /**
   * Timestamp of the most recently imported article. A proxy for the last
   * SUCCESSFUL import, not a run log: a run that imported nothing, or failed,
   * leaves no trace, because ImportResult is returned to the cron caller and
   * discarded. Label this "last imported article" in the UI, never "last run".
   */
  lastImportedAt: string | null;
  lastImportedTitle: string | null;
}

const NEWS_CRON_SCHEDULE = "0 0 * * *";

export async function readNewsSync(): Promise<
  { ok: true; report: NewsSyncReport } | { ok: false; reason: string }
> {
  const channelConfigured = /^\d{17,20}$/.test(
    process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID?.trim() ?? "",
  );

  const db = getDb();
  if (!db) return { ok: false, reason: "The database is not connected." };

  try {
    const [latest] = await db
      .select({
        title: schema.newsArticles.title,
        createdAt: schema.newsArticles.createdAt,
      })
      .from(schema.newsArticles)
      .where(
        and(
          eq(schema.newsArticles.source, "discord"),
          isNotNull(schema.newsArticles.discordMessageId),
        ),
      )
      .orderBy(desc(schema.newsArticles.createdAt))
      .limit(1);

    return {
      ok: true,
      report: {
        channelConfigured,
        cronSchedule: NEWS_CRON_SCHEDULE,
        lastImportedAt: latest?.createdAt ? latest.createdAt.toISOString() : null,
        lastImportedTitle: latest?.title ?? null,
      },
    };
  } catch {
    return { ok: false, reason: "The news table could not be read." };
  }
}

export interface BotActivityEntry {
  id: string;
  kind: "order" | "notice" | "role" | "rank";
  label: string;
  /** Order reference, the notified username, a role name, or a rank movement. */
  detail: string | null;
  actor: string | null;
  /** ISO timestamp. */
  at: string;
  /** Whether the action completed. See BotAuditDescription.ok. */
  ok: boolean;
}

/**
 * Two sources, deliberately.
 *
 * The Discord Confirm/Reject buttons write NO audit row — markOrderDecision
 * updates orders.status / handledBy / handledAt and stops there. Filtering
 * audit_logs for "order.confirm" would silently return nothing forever, so
 * order activity is read from the orders table, which is where it actually
 * lives. Staff notices do write audit rows, so those come from audit_logs.
 */
/*
  The audit actions this panel reports. Anything else written to audit_logs —
  store failures, content edits — belongs to the full audit log, not here.
*/
const BOT_AUDIT_ACTIONS = ["staff.notice", "discord.role", "role.change"];

export async function readBotActivity(): Promise<
  { ok: true; entries: BotActivityEntry[] } | { ok: false; reason: string }
> {
  const db = getDb();
  if (!db) return { ok: false, reason: "The database is not connected." };

  try {
    const [decisions, notices] = await Promise.all([
      db
        .select({
          id: schema.orders.id,
          reference: schema.orders.reference,
          status: schema.orders.status,
          handledBy: schema.orders.handledBy,
          handledAt: schema.orders.handledAt,
        })
        .from(schema.orders)
        .where(
          and(
            isNotNull(schema.orders.handledAt),
            inArray(schema.orders.status, ["confirmed", "rejected"]),
          ),
        )
        .orderBy(desc(schema.orders.handledAt))
        .limit(15),
      db
        .select({
          id: schema.auditLogs.id,
          action: schema.auditLogs.action,
          metadata: schema.auditLogs.metadata,
          createdAt: schema.auditLogs.createdAt,
        })
        .from(schema.auditLogs)
        .where(inArray(schema.auditLogs.action, BOT_AUDIT_ACTIONS))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(15),
    ]);

    /*
      Resolve role names only when a role row is actually present. discord.role
      stores a snowflake, and "Discord role added · 123456789012345678" tells an
      operator nothing. Skipping the lookup when no role row exists keeps the
      common case free of a Discord call, and a failed lookup degrades to the
      raw id rather than dropping the entry.
    */
    const roleNames = new Map<string, string>();
    if (notices.some((row) => row.action === "discord.role")) {
      const token = getDiscordBotToken();
      const guildId = getDiscordGuildId();
      if (token && guildId) {
        for (const role of (await listGuildRoles(token, guildId)) ?? []) {
          roleNames.set(role.id, role.name);
        }
      }
    }

    const entries: BotActivityEntry[] = [
      ...decisions.map((row) => ({
        id: `order-${row.id}`,
        kind: "order" as const,
        label: row.status === "confirmed" ? "Order confirmed" : "Order rejected",
        detail: row.reference,
        actor: row.handledBy,
        // A rejection is a decision that was carried out, not a failure.
        ok: true,
        // Non-null by the isNotNull filter above; the ?? keeps TypeScript happy.
        at: (row.handledAt ?? new Date()).toISOString(),
      })),
      ...notices.flatMap((row) => {
        const metadata = row.metadata as Record<string, unknown> | null;
        const roleId = typeof metadata?.roleId === "string" ? metadata.roleId : null;
        const described = describeBotAuditRow(row.action, metadata, roleId ? (roleNames.get(roleId) ?? null) : null);
        // A row whose action this panel does not report is dropped rather than
        // rendered as a blank line.
        if (!described) return [];
        return [{
          id: `audit-${row.id}`,
          kind: described.kind,
          label: described.label,
          detail: described.detail,
          actor: described.actor,
          at: row.createdAt.toISOString(),
          ok: described.ok,
        }];
      }),
    ];

    entries.sort((a, b) => b.at.localeCompare(a.at));
    return { ok: true, entries: entries.slice(0, 20) };
  } catch {
    return { ok: false, reason: "Bot activity could not be read." };
  }
}
