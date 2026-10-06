import "server-only";
import { desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { isUuid } from "@/lib/validation/id";
import { TYPE_LABEL, asRecord, str, summarise } from "@/lib/audit-subject";

/**
 * Audit trail reader.
 *
 * Rows are written by the privileged actions themselves (role changes, user
 * deletions, news edits, store changes), and each records what it happened to
 * have to hand: a username, a title, a before/after snapshot, or only an id.
 * This turns every row into a readable subject ("Spawn Build-Off", "Order
 * MZ-…", "Steve_42") so the page never has to show a bare id:
 *   1. from the row's own metadata, where the action recorded a name;
 *   2. otherwise by looking the id up (one query per kind of record), which
 *      works while the record still exists.
 * The id is still returned, for search and as a detail on hover.
 *
 * Account deletions deliberately record no name, email or id (see
 * deleteUserAction): only that an account of a given rank was deleted.
 */

export interface AuditEntry {
  id: string;
  action: string;
  /** Coarse family used for grouping and colour: "user", "news", "store"… */
  category: string;
  actor: string | null;
  /** The raw id the action recorded, if any. */
  target: string | null;
  /** What kind of record the subject is ("User", "Product"…). */
  subjectType: string | null;
  /** The readable subject; never a bare id. */
  summary: string;
  /** Where the subject can be opened, when it still exists. */
  href: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

/** Admin pages for each kind of record, used when the record has no page of its own. */
const ADMIN_PAGE: Record<string, string> = {
  user: "/admin/users",
  news: "/admin/news",
  event: "/admin/events",
  product: "/admin/store/catalog",
  game_mode: "/admin/game-modes",
  creator_code: "/admin/store/creator-codes",
  content_creator: "/admin/content-creators",
  order: "/admin/orders",
  suggestion: "/admin/suggestions",
  role: "/admin/roles",
  broadcast: "/admin/notifications",
  audience: "/admin/notifications",
  template: "/admin/notifications",
  forum_post: "/admin/forums",
  rule: "/admin/rules",
};

interface Found {
  name: string;
  href?: string;
}

/**
 * Names (and pages) for ids whose rows only recorded the id, one query per kind
 * of record. Records deleted since simply are not found.
 */
async function lookUp(rows: { targetType: string | null; targetId: string | null }[]): Promise<Map<string, Found>> {
  const db = getDb();
  const found = new Map<string, Found>();
  if (!db) return found;

  const idsOf = (type: string) => [
    ...new Set(rows.filter((r) => r.targetType === type && isUuid(r.targetId)).map((r) => r.targetId as string)),
  ];
  const key = (type: string, id: string) => `${type}:${id}`;

  const tasks: Promise<void>[] = [];
  const run = (type: string, fn: (ids: string[]) => Promise<void>) => {
    const ids = idsOf(type);
    if (ids.length) tasks.push(fn(ids).catch((error) => console.error(`Audit lookup failed for ${type}:`, error)));
  };

  run("user", async (ids) => {
    const list = await db
      .select({ id: schema.profiles.userId, username: schema.profiles.username })
      .from(schema.profiles)
      .where(inArray(schema.profiles.userId, ids));
    for (const r of list) found.set(key("user", r.id), { name: r.username });
  });
  run("news", async (ids) => {
    const list = await db
      .select({ id: schema.newsArticles.id, title: schema.newsArticles.title, slug: schema.newsArticles.slug })
      .from(schema.newsArticles)
      .where(inArray(schema.newsArticles.id, ids));
    for (const r of list) found.set(key("news", r.id), { name: r.title, href: `/news/${r.slug}` });
  });
  run("event", async (ids) => {
    const list = await db
      .select({ id: schema.events.id, title: schema.events.title, slug: schema.events.slug })
      .from(schema.events)
      .where(inArray(schema.events.id, ids));
    for (const r of list) found.set(key("event", r.id), { name: r.title, href: `/events/${r.slug}` });
  });
  run("product", async (ids) => {
    const list = await db
      .select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug })
      .from(schema.products)
      .where(inArray(schema.products.id, ids));
    for (const r of list) found.set(key("product", r.id), { name: r.name, href: `/store/${r.slug}` });
  });
  run("game_mode", async (ids) => {
    const list = await db
      .select({ id: schema.gameModes.id, name: schema.gameModes.name, slug: schema.gameModes.slug })
      .from(schema.gameModes)
      .where(inArray(schema.gameModes.id, ids));
    for (const r of list) found.set(key("game_mode", r.id), { name: r.name, href: `/game-modes/${r.slug}` });
  });
  run("creator_code", async (ids) => {
    const list = await db
      .select({ id: schema.creatorCodes.id, code: schema.creatorCodes.code, creator: schema.creatorCodes.creatorName })
      .from(schema.creatorCodes)
      .where(inArray(schema.creatorCodes.id, ids));
    for (const r of list) found.set(key("creator_code", r.id), { name: `${r.code} (${r.creator})` });
  });
  run("content_creator", async (ids) => {
    const list = await db
      .select({ id: schema.contentCreators.id, name: schema.contentCreators.name })
      .from(schema.contentCreators)
      .where(inArray(schema.contentCreators.id, ids));
    for (const r of list) found.set(key("content_creator", r.id), { name: r.name });
  });
  run("order", async (ids) => {
    const list = await db
      .select({ id: schema.orders.id, reference: schema.orders.reference })
      .from(schema.orders)
      .where(inArray(schema.orders.id, ids));
    for (const r of list) if (r.reference) found.set(key("order", r.id), { name: `Order ${r.reference}` });
  });
  run("suggestion", async (ids) => {
    const list = await db
      .select({ id: schema.suggestions.id, title: schema.suggestions.title })
      .from(schema.suggestions)
      .where(inArray(schema.suggestions.id, ids));
    for (const r of list) found.set(key("suggestion", r.id), { name: r.title, href: `/support/suggestions/${r.id}` });
  });

  await Promise.all(tasks);
  return found;
}

export async function getAuditEntries(limit = 200): Promise<AuditEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit);

    const found = await lookUp(rows);

    return rows.map((row) => {
      const meta = asRecord(row.metadata);
      const type = row.targetType ?? null;
      const lookedUp = type && row.targetId ? found.get(`${type}:${row.targetId}`) : undefined;
      const summary =
        summarise(row.action, type, row.targetId, meta) ??
        lookedUp?.name ??
        (type ? `${TYPE_LABEL[type] ?? "Record"} (no longer exists)` : "—");
      return {
        id: row.id,
        action: row.action,
        category: row.action.split(".")[0] ?? "other",
        actor: str(meta?.by),
        target: row.targetId,
        subjectType: type ? (TYPE_LABEL[type] ?? null) : null,
        summary,
        // Its own page, else its admin section; only while the record still exists.
        href: lookedUp ? (lookedUp.href ?? (type ? ADMIN_PAGE[type] : undefined) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
        metadata: meta,
      };
    });
  } catch (error) {
    console.error("Failed to load audit entries:", error);
    return [];
  }
}
