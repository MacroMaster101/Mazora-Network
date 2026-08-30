"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import { canReport, REPORT_REASONS, type ReportActor, type ReportTarget } from "@/lib/report-rules";

/**
 * The write side of community reporting. This is a security boundary, not a
 * presentation detail: the UI hides report/resolve/dismiss controls it
 * shouldn't show, but that is cosmetic only — every rule here is re-checked
 * against the database, because a hidden button is not an absent endpoint.
 *
 * `reportContentAction` follows the same order as the rest of this codebase's
 * write actions: resolve session -> Zod parse the shape -> load the target
 * row it needs -> build a ReportTarget -> apply the report-rules.ts predicate
 * -> rate limit -> insert (relying on the partial unique indexes from
 * migration 039 for the "already reported" guarantee, not re-implementing
 * it) -> revalidatePath.
 *
 * `resolveReportAction` / `dismissReportAction` require canManageSuggestions,
 * then derive the report's target strictly from the report row they load —
 * never from caller input — so `allForTarget` can never be steered at a
 * target the named report does not actually belong to. They are also rate
 * limited: not because auditing can flood (each report is audited exactly
 * once, since the WHERE clause only ever matches `status = 'open'` and
 * nothing can reopen a report), but because `allForTarget: true` lets a
 * single call clear every open report on one item, and a compromised staff
 * session could otherwise clear the entire open queue as fast as the network
 * allows. The rate limit bounds that blast radius.
 */

type Result = { ok: boolean; message: string };

const uuidSchema = z.string().uuid();

const reportContentSchema = z
  .object({
    suggestionId: uuidSchema.nullish(),
    replyId: uuidSchema.nullish(),
    reason: z.enum(REPORT_REASONS),
    // An untouched form field submits "", not undefined — .optional() alone
    // only short-circuits on undefined, so a blank note would otherwise fail
    // .min(1) and collapse the whole parse. Treat a blank/whitespace-only
    // note as "no note" instead of a validation failure.
    note: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((v) => Boolean(v.suggestionId) !== Boolean(v.replyId), {
    message: "Choose exactly one thing to report.",
  });

/**
 * Turns a failed `reportContentSchema` parse into an actionable message
 * instead of one catch-all string. Checked by field, not issue order, so a
 * single message wins even when a caller manages to trip more than one rule
 * at once (e.g. a too-long note AND a bad reason).
 */
function reportParseErrorMessage(issues: z.ZodIssue[]): string {
  const failedOn = (field: string) => issues.some((issue) => issue.path[0] === field);
  if (failedOn("note")) return "Your note must be 1000 characters or fewer.";
  if (failedOn("reason")) return "Choose a valid reason for the report.";
  if (failedOn("suggestionId") || failedOn("replyId")) return "That item could not be identified.";
  // Only the object-level refine (exactly-one-target) is left, which has no path.
  return "Choose exactly one thing to report.";
}

const resolutionInputSchema = z.object({
  reportId: uuidSchema,
  allForTarget: z.boolean().optional(),
});

/**
 * Files a report against a suggestion or a reply.
 *
 * `canReport` refuses a guest, a member reporting their own content, and a
 * report against already-removed content. It deliberately does not check
 * "already reported" — that is enforced by `content_reports_one_per_suggestion`
 * / `content_reports_one_per_reply` (migration 039), which `.onConflictDoNothing()`
 * relies on below. A duplicate report is treated as a success the member
 * already achieved, not an error.
 */
export async function reportContentAction(input: {
  suggestionId?: string | null;
  replyId?: string | null;
  reason: string;
  note?: string;
}): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in to report content." };

  const parsed = reportContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: reportParseErrorMessage(parsed.error.issues) };
  const { suggestionId, replyId, reason, note } = parsed.data;

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  let authorId: string;
  let deletedAt: string | null;

  if (suggestionId) {
    const [row] = await db
      .select({ authorId: schema.suggestions.userId })
      .from(schema.suggestions)
      .where(eq(schema.suggestions.id, suggestionId))
      .limit(1);
    if (!row) return { ok: false, message: "That suggestion no longer exists." };
    authorId = row.authorId;
    deletedAt = null;
  } else {
    // parsed's refine guarantees replyId is set when suggestionId is not.
    const [row] = await db
      .select({ authorId: schema.suggestionReplies.userId, deletedAt: schema.suggestionReplies.deletedAt })
      .from(schema.suggestionReplies)
      .where(eq(schema.suggestionReplies.id, replyId as string))
      .limit(1);
    if (!row) return { ok: false, message: "That reply no longer exists." };
    authorId = row.authorId;
    deletedAt = row.deletedAt ? row.deletedAt.toISOString() : null;
  }

  const actor: ReportActor = { userId, role: session.role };
  const target: ReportTarget = { authorId, deletedAt };

  if (!canReport(target, actor)) {
    const message = target.deletedAt
      ? "That content was already removed."
      : "You cannot report your own content.";
    return { ok: false, message };
  }

  const limit = await rateLimitShared(await actionClientKey("content-report", userId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "You're reporting too fast. Wait a moment and try again." };

  try {
    // No `target:` list here — deliberately, not an oversight. Uniqueness is
    // split across two PARTIAL unique indexes (migration 039):
    // `content_reports_one_per_suggestion` and `content_reports_one_per_reply`.
    // Exactly one of suggestionId/replyId is set per row, so no single index
    // covers every insert and Drizzle's typed `target:` can only name one
    // index at a time anyway. The untargeted clause matches a violation of
    // EITHER index. If a third unique index is ever added to this table,
    // revisit this — an untargeted clause would silently swallow that
    // conflict too and report success for what should be a real error.
    const inserted = await db
      .insert(schema.contentReports)
      .values({
        reporterId: userId,
        suggestionId: suggestionId ?? null,
        replyId: replyId ?? null,
        reason,
        note: note ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.contentReports.id });

    if (inserted.length === 0) {
      // The partial unique index rejected this as a duplicate. From the
      // reporter's point of view they already achieved what they wanted, so
      // this is a success, not an error.
      return { ok: true, message: "You have already reported this." };
    }
  } catch (error) {
    console.error("Failed to file content report", error);
    return { ok: false, message: "Failed to submit your report." };
  }

  revalidatePath("/admin/suggestions/reports");
  return { ok: true, message: "Report submitted. Thank you for helping keep the board clean." };
}

/**
 * Shared implementation for resolve/dismiss. `status`/`action` are fixed by
 * the two exported wrappers below, never caller-supplied, so a caller cannot
 * pick which audit action gets logged for a given write.
 */
async function setReportStatus(
  input: { reportId: string; allForTarget?: boolean },
  status: "resolved" | "dismissed",
  action: "reports.resolve" | "reports.dismiss",
): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "Not authorized." };

  const allowed = await canManageSuggestions(session, userId);
  if (!allowed) return { ok: false, message: "You don't have permission to manage reports." };

  const parsed = resolutionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That report no longer exists." };
  const { reportId, allForTarget } = parsed.data;

  // Bounds the blast radius of `allForTarget: true`, which can clear every
  // open report on one item in a single call: a compromised staff session
  // could otherwise drain the entire open queue as fast as the network
  // allows. Not there to stop audit-log flooding — the WHERE clause below
  // only ever matches status = 'open' and nothing can reopen a report, so
  // each one is audited at most once regardless of how many times this is
  // called.
  const limit = await rateLimitShared(await actionClientKey("report-resolve", userId), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many changes. Wait a moment and try again." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [report] = await db
    .select({
      suggestionId: schema.contentReports.suggestionId,
      replyId: schema.contentReports.replyId,
    })
    .from(schema.contentReports)
    .where(eq(schema.contentReports.id, reportId))
    .limit(1);
  if (!report) return { ok: false, message: "That report no longer exists." };

  // The target is derived only from the report row just loaded from the
  // database, never from caller input — `allForTarget` cannot be pointed at
  // a target the named report does not itself belong to.
  const targetId = report.suggestionId ?? report.replyId;
  if (!targetId) return { ok: false, message: "That report no longer exists." };
  const targetType = report.suggestionId !== null ? "suggestion" : "reply";
  const targetCondition =
    report.suggestionId !== null
      ? eq(schema.contentReports.suggestionId, report.suggestionId)
      : eq(schema.contentReports.replyId, targetId);

  const now = new Date();
  const whereClause = allForTarget
    ? and(targetCondition, eq(schema.contentReports.status, "open"))
    : and(eq(schema.contentReports.id, reportId), eq(schema.contentReports.status, "open"));

  try {
    const updated = await db
      .update(schema.contentReports)
      .set({ status, resolvedBy: userId, resolvedAt: now })
      .where(whereClause)
      .returning({ id: schema.contentReports.id });

    if (updated.length === 0) return { ok: false, message: "That report was already handled." };

    await db.insert(schema.auditLogs).values({
      actorId: userId,
      action,
      targetType,
      targetId,
      metadata: { reportId, count: updated.length, allForTarget: Boolean(allForTarget), by: session.username },
    });
  } catch (error) {
    console.error(`Failed to set report status to ${status}`, error);
    return { ok: false, message: "Failed to update the report." };
  }

  revalidatePath("/admin/suggestions/reports");
  const verb = status === "resolved" ? "resolved" : "dismissed";
  return {
    ok: true,
    message: allForTarget ? `All reports on this item ${verb}.` : `Report ${verb}.`,
  };
}

/** Staff-only: marks a report resolved (the underlying content was actioned). */
export async function resolveReportAction(input: { reportId: string; allForTarget?: boolean }): Promise<Result> {
  return setReportStatus(input, "resolved", "reports.resolve");
}

/** Staff-only: marks a report dismissed (no action needed on the content). */
export async function dismissReportAction(input: { reportId: string; allForTarget?: boolean }): Promise<Result> {
  return setReportStatus(input, "dismissed", "reports.dismiss");
}
