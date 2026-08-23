import "server-only";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { BOT_VAR_SPECS, classifyBotVar, type BotVarStatus } from "@/lib/bot-config";
import { getDb, schema } from "@/lib/db/client";
import { fetchChannel, getDiscordBotToken } from "@/lib/discord";

/**
 * Readers for the /admin/mazora-bot console.
 *
 * Every function returns a discriminated result rather than throwing, so one
 * unreachable dependency degrades a single card instead of blanking the page.
 * Nothing here returns a secret: the config matrix reports verdicts only.
 */

export interface BotVarReport {
  name: string;
  label: string;
  impact: string;
  status: BotVarStatus;
}

/** Synchronous: reads process.env, hits nothing over the network. */
export function readConfigMatrix(): BotVarReport[] {
  return BOT_VAR_SPECS.map((spec) => ({
    name: spec.name,
    label: spec.label,
    impact: spec.impact,
    // Only the verdict escapes this function. The value never does.
    status: classifyBotVar(spec.kind, process.env[spec.name]),
  }));
}

export interface BotHealthFlags {
  tokenSet: boolean;
  keyOk: boolean;
}

/**
 * The two raw-token checks BotHealthPanel needs, read here instead of in the
 * component itself.
 *
 * This module's contract — stated at the top of this file — is that the
 * token never enters any module the client bundles. Reading
 * `process.env.DISCORD_BOT_TOKEN` directly inside a component file is one
 * stray `"use client"` away from breaking that, even though nothing today
 * leaks it (Next only inlines `NEXT_PUBLIC_*`). Keeping every `classifyBotVar`
 * call against a secret in this server-only reader means the invariant is
 * enforced by where the code lives, not by remembering not to add a directive.
 */
export function readBotHealthFlags(): BotHealthFlags {
  return {
    tokenSet: classifyBotVar("text", process.env.DISCORD_BOT_TOKEN) === "set",
    keyOk: classifyBotVar("hex64", process.env.DISCORD_APP_PUBLIC_KEY) === "set",
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
  kind: "order" | "notice";
  label: string;
  /** Order reference, or the notified username. */
  detail: string | null;
  actor: string | null;
  /** ISO timestamp. */
  at: string;
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
          metadata: schema.auditLogs.metadata,
          createdAt: schema.auditLogs.createdAt,
        })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.action, "staff.notice"))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(15),
    ]);

    const entries: BotActivityEntry[] = [
      ...decisions.map((row) => ({
        id: `order-${row.id}`,
        kind: "order" as const,
        label: row.status === "confirmed" ? "Order confirmed" : "Order rejected",
        detail: row.reference,
        actor: row.handledBy,
        // Non-null by the isNotNull filter above; the ?? keeps TypeScript happy.
        at: (row.handledAt ?? new Date()).toISOString(),
      })),
      ...notices.map((row) => {
        const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
        return {
          id: `notice-${row.id}`,
          kind: "notice" as const,
          label:
            metadata.delivered === false ? "Staff notice failed" : "Staff notice sent",
          detail: typeof metadata.username === "string" ? metadata.username : null,
          actor: typeof metadata.by === "string" ? metadata.by : null,
          at: row.createdAt.toISOString(),
        };
      }),
    ];

    entries.sort((a, b) => b.at.localeCompare(a.at));
    return { ok: true, entries: entries.slice(0, 20) };
  } catch {
    return { ok: false, reason: "Bot activity could not be read." };
  }
}
