"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, FORUMS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { deletePostAction } from "@/lib/actions/forums";
import { getDb, schema } from "@/lib/db/client";
import { removeForumPostImages } from "@/lib/forums/image-store";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import { isValidSlug, moveInOrder, slugify } from "@/lib/forums-rules";

export interface ForumAdminResult {
  ok: boolean;
  message: string;
  /** Set when a forum is created, so the public board can take the creator straight to it. */
  forumSlug?: string;
}

/** Every mutation here resolves the same configurable module, fail-closed. */
async function authorize(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const userId = await getSessionUserId();
  return canManageModule(FORUMS_PERMISSION_KEY, session, userId);
}

function readName(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "").trim();
}

const DESCRIPTION_MAX = 200;

/** Caps a description server-side — the input's `maxLength` is a UI hint a direct caller bypasses. */
function readDescription(formData: FormData): string | null {
  const value = readName(formData, "description");
  return value ? value.slice(0, DESCRIPTION_MAX) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

function readCategoryName(formData: FormData, field: string): string | { error: string } {
  const name = readName(formData, field);
  if (name.length < 2 || name.length > 80) return { error: "Category names must be 2–80 characters." };
  return name;
}

/** Validates a forum name and derives its URL slug, refusing slugs that could never be reached. */
function readForum(formData: FormData): { name: string; slug: string } | { error: string } {
  const name = readName(formData, "name");
  if (name.length < 2 || name.length > 80) return { error: "Forum names must be 2–80 characters." };
  const slug = slugify(readName(formData, "slug") || name);
  if (!isValidSlug(slug)) return { error: "That name does not produce a usable URL." };
  // "topic" and "search" are static segments under /forums (/forums/topic/[topicId],
  // and phase 6's /forums/search) — a forum with either slug would sit behind that
  // route and permanently 404.
  if (slug === "topic" || slug === "search") {
    return { error: `"${slug}" is a reserved URL and cannot be used as a forum slug.` };
  }
  return { name, slug };
}

/** New rows go to the end. Left at the column default of 0 they tied with, and jumped ahead of, the first row. */
async function nextCategoryOrder(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(${schema.forumCategories.sortOrder})` })
    .from(schema.forumCategories);
  return (row?.max ?? -1) + 1;
}

async function nextForumOrder(tx: Tx, categoryId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(${schema.forums.sortOrder})` })
    .from(schema.forums)
    .where(eq(schema.forums.categoryId, categoryId));
  return (row?.max ?? -1) + 1;
}

function refresh() {
  revalidatePath("/forums");
  revalidatePath("/admin/forums");
}

export async function createCategoryAction(formData: FormData): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };

  const name = readCategoryName(formData, "name");
  if (typeof name !== "string") return { ok: false, message: name.error };
  const slug = slugify(readName(formData, "slug") || name);
  if (!isValidSlug(slug)) return { ok: false, message: "That name does not produce a usable URL." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    await db.transaction(async (tx) => {
      const sortOrder = await nextCategoryOrder(tx);
      await tx.insert(schema.forumCategories).values({ name, slug, description: readDescription(formData), sortOrder });
    });
    refresh();
    return { ok: true, message: `${name} created.` };
  } catch {
    return { ok: false, message: "That category could not be created — the URL may already be taken." };
  }
}

/**
 * Create a forum. Used by the Create a forum dialog on the public board and in
 * the admin, where the category is typed or picked: an existing category is
 * matched by name (ignoring case), and any other name creates that category
 * first. Both inserts share one
 * transaction, so a forum that fails never leaves an empty category behind.
 */
export async function createForumInCategoryAction(formData: FormData): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };

  const categoryName = readCategoryName(formData, "categoryName");
  if (typeof categoryName !== "string") return { ok: false, message: categoryName.error };
  const categorySlug = slugify(categoryName);
  if (!isValidSlug(categorySlug)) return { ok: false, message: "That category name does not produce a usable URL." };
  const forum = readForum(formData);
  if ("error" in forum) return { ok: false, message: forum.error };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  type Outcome = { createdCategory: boolean } | "forum-taken";
  let outcome: Outcome;
  try {
    outcome = await db.transaction(async (tx): Promise<Outcome> => {
      const [existing] = await tx
        .select({ id: schema.forumCategories.id })
        .from(schema.forumCategories)
        .where(sql`lower(${schema.forumCategories.name}) = lower(${categoryName}) or ${schema.forumCategories.slug} = ${categorySlug}`)
        .limit(1);

      let categoryId = existing?.id;
      if (!categoryId) {
        const [created] = await tx
          .insert(schema.forumCategories)
          .values({ name: categoryName, slug: categorySlug, sortOrder: await nextCategoryOrder(tx) })
          .returning({ id: schema.forumCategories.id });
        categoryId = created.id;
      }

      const inserted = await tx
        .insert(schema.forums)
        .values({
          categoryId,
          name: forum.name,
          slug: forum.slug,
          description: readDescription(formData),
          sortOrder: await nextForumOrder(tx, categoryId),
        })
        .onConflictDoNothing({ target: schema.forums.slug })
        .returning({ id: schema.forums.id });
      // Throwing rolls back a category created for this forum alone.
      if (!inserted.length) throw new ForumTaken();
      return { createdCategory: !existing };
    });
  } catch (error) {
    if (error instanceof ForumTaken) outcome = "forum-taken";
    else {
      console.error("Failed to create forum", error);
      return { ok: false, message: "That forum could not be created. Please try again." };
    }
  }

  if (outcome === "forum-taken") {
    return { ok: false, message: "A forum with that name already exists. Try a different name." };
  }
  refresh();
  return {
    ok: true,
    message: outcome.createdCategory ? `${forum.name} created in the new ${categoryName} category.` : `${forum.name} created.`,
    forumSlug: forum.slug,
  };
}

class ForumTaken extends Error {}

export async function updateCategoryAction(formData: FormData): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };

  const categoryId = String(formData.get("categoryId") ?? "");
  const name = readName(formData, "name");
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Category names must be 2–80 characters." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    // The slug is deliberately NOT renamed: it is in every link already shared.
    const updated = await db
      .update(schema.forumCategories)
      .set({ name, description: readDescription(formData), updatedAt: new Date() })
      .where(eq(schema.forumCategories.id, categoryId))
      .returning({ id: schema.forumCategories.id });
    if (!updated.length) return { ok: false, message: "Unknown category." };
    revalidatePath("/forums");
    revalidatePath("/admin/forums");
    return { ok: true, message: `${name} updated.` };
  } catch {
    return { ok: false, message: "That category could not be updated." };
  }
}

export async function updateForumAction(formData: FormData): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };

  const forumId = String(formData.get("forumId") ?? "");
  const name = readName(formData, "name");
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Forum names must be 2–80 characters." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    // Same reasoning as categories: renaming must not move the URL.
    const updated = await db
      .update(schema.forums)
      .set({ name, description: readDescription(formData), updatedAt: new Date() })
      .where(eq(schema.forums.id, forumId))
      .returning({ id: schema.forums.id });
    if (!updated.length) return { ok: false, message: "Unknown forum." };
    revalidatePath("/forums");
    revalidatePath("/admin/forums");
    return { ok: true, message: `${name} updated.` };
  } catch {
    return { ok: false, message: "That forum could not be updated." };
  }
}

async function swapForumOrder(forumId: string, direction: "up" | "down"): Promise<ForumAdminResult> {
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const [row] = await db.select().from(schema.forums).where(eq(schema.forums.id, forumId)).limit(1);
    if (!row) return { ok: false, message: "That row no longer exists." };

    const siblings = await db
      .select()
      .from(schema.forums)
      .where(eq(schema.forums.categoryId, row.categoryId))
      .orderBy(asc(schema.forums.sortOrder), asc(schema.forums.name));

    const index = siblings.findIndex((item) => item.id === row.id);
    const reordered = moveInOrder(siblings, index, direction);
    if (reordered.every((item, position) => item.id === siblings[position].id)) {
      return { ok: true, message: "Already at the end." };
    }

    // Renumber by position inside one transaction. Only rows whose position
    // actually changed are written, and a failure part-way rolls back every
    // one — no half-swapped pair can survive. Existing ties are normalised to
    // 0..n-1 on the first move.
    await db.transaction(async (tx) => {
      for (const [position, item] of reordered.entries()) {
        if (item.sortOrder === position) continue;
        await tx.update(schema.forums).set({ sortOrder: position, updatedAt: new Date() }).where(eq(schema.forums.id, item.id));
      }
    });

    revalidatePath("/forums");
    revalidatePath("/admin/forums");
    return { ok: true, message: "Order updated." };
  } catch {
    return { ok: false, message: "That order could not be changed." };
  }
}

async function swapCategoryOrder(categoryId: string, direction: "up" | "down"): Promise<ForumAdminResult> {
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const [row] = await db.select().from(schema.forumCategories).where(eq(schema.forumCategories.id, categoryId)).limit(1);
    if (!row) return { ok: false, message: "That row no longer exists." };

    const siblings = await db
      .select()
      .from(schema.forumCategories)
      .orderBy(asc(schema.forumCategories.sortOrder), asc(schema.forumCategories.name));

    const index = siblings.findIndex((item) => item.id === row.id);
    const reordered = moveInOrder(siblings, index, direction);
    if (reordered.every((item, position) => item.id === siblings[position].id)) {
      return { ok: true, message: "Already at the end." };
    }

    // Renumber by position inside one transaction. Only rows whose position
    // actually changed are written, and a failure part-way rolls back every
    // one — no half-swapped pair can survive. Existing ties are normalised to
    // 0..n-1 on the first move.
    await db.transaction(async (tx) => {
      for (const [position, item] of reordered.entries()) {
        if (item.sortOrder === position) continue;
        await tx
          .update(schema.forumCategories)
          .set({ sortOrder: position, updatedAt: new Date() })
          .where(eq(schema.forumCategories.id, item.id));
      }
    });

    revalidatePath("/forums");
    revalidatePath("/admin/forums");
    return { ok: true, message: "Order updated." };
  } catch {
    return { ok: false, message: "That order could not be changed." };
  }
}

export async function moveForumAction(forumId: string, direction: string): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };
  // A direct caller bypasses the "up" | "down" type; anything else is neither
  // "up" nor down, so it is refused rather than silently treated as "down".
  if (direction !== "up" && direction !== "down") return { ok: false, message: "Invalid direction." };
  return swapForumOrder(forumId, direction);
}

export async function moveCategoryAction(categoryId: string, direction: string): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };
  if (direction !== "up" && direction !== "down") return { ok: false, message: "Invalid direction." };
  return swapCategoryOrder(categoryId, direction);
}

export async function setForumLockedAction(forumId: string, locked: boolean): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    await db.update(schema.forums).set({ locked, updatedAt: new Date() }).where(eq(schema.forums.id, forumId));
    revalidatePath("/forums");
    revalidatePath("/admin/forums");
    return { ok: true, message: locked ? "Forum locked." : "Forum unlocked." };
  } catch {
    return { ok: false, message: "That forum could not be updated." };
  }
}

export async function deleteForumAction(forumId: string): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };
  if (!UUID.test(forumId)) return { ok: false, message: "Unknown forum." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    // The cascade removes the image rows but not the stored files, which would
    // stay public on the bucket. Collect them first, remove them after.
    const posts = await db
      .select({ id: schema.forumPosts.id })
      .from(schema.forumPosts)
      .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
      .where(eq(schema.forumTopics.forumId, forumId));
    await removeForumPostImages(posts.map((post) => post.id));

    const deleted = await db.delete(schema.forums).where(eq(schema.forums.id, forumId)).returning({ id: schema.forums.id });
    if (!deleted.length) return { ok: false, message: "Unknown forum." };
    refresh();
    return { ok: true, message: "Forum deleted." };
  } catch {
    return { ok: false, message: "That forum could not be deleted." };
  }
}

/**
 * Deletes an empty category. One that still holds forums is refused rather
 * than cascaded: a single click must never take every topic in several
 * forums with it. Move or delete the forums first.
 */
export async function deleteCategoryAction(categoryId: string): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage forums." };
  if (!UUID.test(categoryId)) return { ok: false, message: "Unknown category." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    const deleted = await db.transaction(async (tx) => {
      const [{ n }] = await tx.select({ n: count() }).from(schema.forums).where(eq(schema.forums.categoryId, categoryId));
      if (n > 0) return "has-forums" as const;
      const rows = await tx
        .delete(schema.forumCategories)
        .where(eq(schema.forumCategories.id, categoryId))
        .returning({ id: schema.forumCategories.id });
      return rows.length ? ("deleted" as const) : ("missing" as const);
    });
    if (deleted === "has-forums") return { ok: false, message: "Delete or move this category's forums first." };
    if (deleted === "missing") return { ok: false, message: "Unknown category." };
    refresh();
    return { ok: true, message: "Category deleted." };
  } catch {
    return { ok: false, message: "That category could not be deleted." };
  }
}

/**
 * Close the open reports on a post: "resolved" when the post was dealt with,
 * "dismissed" when it needs no action.
 *
 * The post is taken from the report row, never from the caller, so this can
 * only ever close reports on the post the named report is actually about.
 * Rate limited because one call clears every report on a post, and audited.
 */
async function closeReportsOnPost(
  reportId: string,
  status: "resolved" | "dismissed",
): Promise<ForumAdminResult & { postId?: string }> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !userId || !(await canManageModule(FORUMS_PERMISSION_KEY, session, userId))) {
    return { ok: false, message: "You do not have permission to manage reports." };
  }
  if (!UUID.test(reportId)) return { ok: false, message: "That report no longer exists." };

  const limit = await rateLimitShared(await actionClientKey("forum-report-close", userId), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many changes. Wait a moment and try again." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const [report] = await db
      .select({ postId: schema.forumReports.postId })
      .from(schema.forumReports)
      .where(eq(schema.forumReports.id, reportId))
      .limit(1);
    if (!report?.postId) return { ok: false, message: "That report no longer exists." };

    const closed = await db
      .update(schema.forumReports)
      .set({ status, resolvedAt: new Date(), resolvedBy: userId })
      .where(and(eq(schema.forumReports.postId, report.postId), eq(schema.forumReports.status, "open")))
      .returning({ id: schema.forumReports.id });
    if (!closed.length) return { ok: false, message: "Those reports were already handled." };

    await db.insert(schema.auditLogs).values({
      actorId: userId,
      action: status === "resolved" ? "forums.reports.resolve" : "forums.reports.dismiss",
      targetType: "forum_post",
      targetId: report.postId,
      metadata: { reportId, count: closed.length, by: session.username },
    });

    revalidatePath("/admin/forums");
    revalidatePath("/admin/forums/reports");
    const noun = closed.length === 1 ? "Report" : `${closed.length} reports`;
    return { ok: true, message: `${noun} ${status}.`, postId: report.postId };
  } catch (error) {
    console.error("Failed to close forum reports", error);
    return { ok: false, message: "Those reports could not be updated." };
  }
}

/** The post needs no action: dismiss every open report on it. */
export async function dismissForumReportAction(reportId: string): Promise<ForumAdminResult> {
  const { ok, message } = await closeReportsOnPost(reportId, "dismissed");
  return { ok, message };
}

/**
 * Remove the reported post, then resolve every open report on it.
 *
 * Removal goes through deletePostAction, the same path the Remove button on
 * the topic uses, so its rules still apply: a moderator check, image cleanup,
 * and removing the opening post removes the whole topic.
 */
export async function removeReportedPostAction(reportId: string): Promise<ForumAdminResult> {
  if (!(await authorize())) return { ok: false, message: "You do not have permission to manage reports." };
  if (!UUID.test(reportId)) return { ok: false, message: "That report no longer exists." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [report] = await db
    .select({
      postId: schema.forumReports.postId,
      postDeletedAt: schema.forumPosts.deletedAt,
      topicDeletedAt: schema.forumTopics.deletedAt,
    })
    .from(schema.forumReports)
    .innerJoin(schema.forumPosts, eq(schema.forumPosts.id, schema.forumReports.postId))
    .innerJoin(schema.forumTopics, eq(schema.forumTopics.id, schema.forumPosts.topicId))
    .where(eq(schema.forumReports.id, reportId))
    .limit(1);
  if (!report?.postId) return { ok: false, message: "That report no longer exists." };

  // Content someone already removed only needs its reports closed.
  let topicRemoved = false;
  if (!report.postDeletedAt && !report.topicDeletedAt) {
    const removed = await deletePostAction(report.postId);
    if (!removed.ok) return removed;
    topicRemoved = Boolean(removed.topicRemoved);
  }

  const closed = await closeReportsOnPost(reportId, "resolved");
  if (!closed.ok) return closed;
  return { ok: true, message: topicRemoved ? "Topic removed and reports resolved." : "Post removed and reports resolved." };
}
