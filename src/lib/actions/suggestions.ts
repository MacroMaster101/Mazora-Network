"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { dispatchSuggestionReplyNotification } from "@/lib/notifications-auto";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import { attachmentCountError, filesFromFormData, imageSizeError, urlsFromFormData } from "@/lib/suggestion-image-rules";
import {
  canDeleteReply,
  canEditReply,
  canPostReply,
  canVote,
  effectiveParentId,
  type ReplyActor,
  type ReplySubject,
  type ThreadState,
} from "@/lib/suggestions-rules";
import { removeSuggestionImageObject, storeSuggestionImages, storeSuggestionImagesFromUrls } from "@/lib/suggestions/image-store";

/**
 * The write side of the suggestions board. Guests read it; signed-in members
 * reply and vote; staff lock threads and remove replies. The UI also hides
 * controls it shouldn't show, but that is presentation only — every rule here
 * is re-checked against the database, because a hidden button is not an
 * absent endpoint. Every action follows the same order: resolve session ->
 * load the thread/reply state it needs -> build a ReplyActor -> apply the
 * suggestions-rules.ts predicate -> Zod parse -> rate limit (where required)
 * -> write -> revalidatePath.
 */

type Result = { ok: boolean; message: string };

/** Matches the SQL CHECK constraint on suggestion_replies.body (migration 038). */
const replyBodySchema = z.string().trim().min(1).max(4000);

const suggestionIdSchema = z.string().uuid();
const replyIdSchema = z.string().uuid();

const postReplySchema = z.object({
  suggestionId: suggestionIdSchema,
  body: replyBodySchema,
  parentId: z.string().uuid().optional(),
});

const editReplySchema = z.object({
  replyId: replyIdSchema,
  body: replyBodySchema,
});

const lockSchema = z.object({
  suggestionId: suggestionIdSchema,
  locked: z.boolean(),
});

function refreshSuggestionPages(suggestionId: string) {
  revalidatePath("/support/suggestions");
  revalidatePath(`/support/suggestions/${suggestionId}`);
}

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Posts a reply to a suggestion thread.
 *
 * `canPostReply` refuses a locked thread and an anonymous caller. That check
 * runs against the row just loaded from the database, so a composer rendered
 * before a moderator locked the thread is still refused here even though the
 * client had no way to know yet.
 */
export async function postSuggestionReplyAction(formData: FormData): Promise<Result> {
  const suggestionIdRaw = String(formData.get("suggestionId") ?? "");
  const body = String(formData.get("body") ?? "");
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || undefined;

  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in to reply." };

  const idCheck = suggestionIdSchema.safeParse(suggestionIdRaw);
  if (!idCheck.success) return { ok: false, message: "That suggestion no longer exists." };
  const suggestionId = idCheck.data;

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [suggestion] = await db
    .select({
      title: schema.suggestions.title,
      authorId: schema.suggestions.userId,
      locked: schema.suggestions.locked,
    })
    .from(schema.suggestions)
    .where(eq(schema.suggestions.id, suggestionId))
    .limit(1);
  if (!suggestion) return { ok: false, message: "That suggestion no longer exists." };

  const canModerate = await canManageSuggestions(session, userId);
  const actor: ReplyActor = { userId, role: session.role, canModerate };
  const thread: ThreadState = { locked: Boolean(suggestion.locked) };

  if (!canPostReply(thread, actor)) {
    return { ok: false, message: thread.locked ? "This thread is locked." : "You must be signed in to reply." };
  }

  const parsed = postReplySchema.safeParse({ suggestionId, body, parentId });
  if (!parsed.success) return { ok: false, message: "Your reply must be between 1 and 4000 characters." };

  const limit = await rateLimitShared(await actionClientKey("suggestion-reply", userId), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "You're replying too fast. Wait a moment and try again." };

  // Pure input validation: refuse an over-cap batch BEFORE anything is written,
  // so a member never sees a failure message for a reply that was in fact
  // posted. (Storage failures below are different — those come after the insert
  // and must never roll it back.)
  const files = filesFromFormData(formData, "images");
  const imageUrls = urlsFromFormData(formData, "imageUrls");
  const countError = attachmentCountError(files.length, imageUrls.length);
  if (countError) return { ok: false, message: countError };
  for (const file of files) {
    const sizeError = imageSizeError(file.size);
    if (sizeError) return { ok: false, message: sizeError };
  }

  // Resolve the effective parent before the insert: this is the security
  // boundary that caps nesting at one level and keeps a reply inside its own
  // suggestion's thread, enforced here rather than trusted from the client.
  let effectiveParent: string | null = null;
  // The person actually being answered is the author of the reply the member
  // clicked "reply" on (`parent.authorId`), not the top-level ancestor's
  // author — those differ whenever the clicked reply was itself a child.
  let answeredAuthorId: string | null = null;
  if (parentId) {
    const parentCheck = z.string().uuid().safeParse(parentId);
    if (!parentCheck.success) return { ok: false, message: "That reply no longer exists." };
    const [parent] = await db
      .select({
        id: schema.suggestionReplies.id,
        parentId: schema.suggestionReplies.parentId,
        suggestionId: schema.suggestionReplies.suggestionId,
        deletedAt: schema.suggestionReplies.deletedAt,
        authorId: schema.suggestionReplies.userId,
      })
      .from(schema.suggestionReplies)
      .where(eq(schema.suggestionReplies.id, parentCheck.data))
      .limit(1);
    // A reply may only nest within its own thread, and not under a removed reply.
    if (!parent || parent.suggestionId !== suggestionId || parent.deletedAt) {
      return { ok: false, message: "That reply is no longer available." };
    }
    effectiveParent = effectiveParentId({ id: parent.id, parentId: parent.parentId });
    answeredAuthorId = parent.authorId;
  }

  let replyId: string | undefined;
  try {
    const [inserted] = await db
      .insert(schema.suggestionReplies)
      .values({
        suggestionId,
        userId,
        body: parsed.data.body,
        parentId: effectiveParent,
      })
      .returning({ id: schema.suggestionReplies.id });
    replyId = inserted?.id;
  } catch (error) {
    console.error("Failed to post suggestion reply", error);
    return { ok: false, message: "Failed to post your reply." };
  }

  refreshSuggestionPages(suggestionId);

  if (replyId && (files.length || imageUrls.length)) {
    const target = { kind: "reply" as const, id: replyId };
    const uploaded = await storeSuggestionImages(files, target);
    // Links continue the sort order after the uploads.
    const linked = await storeSuggestionImagesFromUrls(imageUrls, target, uploaded.length);
    const stored = [...uploaded, ...linked];
    if (stored.length) {
      try {
        await db.insert(schema.suggestionImages).values(
          stored.map((image) => ({
            replyId,
            userId,
            url: image.url,
            storageKey: image.storageKey,
            sortOrder: image.sortOrder,
          })),
        );
      } catch (error) {
        // The reply itself is already committed above; a failure here (a
        // dropped connection, an FK issue) must not surface as a failed
        // reply post — that would invite a duplicate retry of a reply that
        // is already live. Log and fall through to the success return.
        console.error("Failed to attach images to suggestion reply", error);
      }
    }
  }

  // A nested reply answers a specific person, so the notification goes to
  // whoever was actually replied to — not the suggestion author.
  const replyTargetAuthorId = answeredAuthorId ?? suggestion.authorId;

  // Best-effort: dispatchSuggestionReplyNotification already swallows its own
  // errors internally, so this can never fail the reply that just landed.
  await dispatchSuggestionReplyNotification({
    authorId: replyTargetAuthorId,
    replierId: userId,
    suggestionId,
    suggestionTitle: suggestion.title,
    replierName: session.displayName || session.username,
    context: effectiveParent ? "reply" : "suggestion",
  });

  return { ok: true, message: "Reply posted." };
}

/**
 * Edits the caller's own reply.
 *
 * `canEditReply` only ever matches `actor.userId === reply.authorId` — a
 * moderator's `canModerate` plays no part in it, so this can never be used to
 * rewrite someone else's words, only to remove them (see delete, below).
 */
export async function editSuggestionReplyAction(input: { replyId: string; body: string }): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in to edit a reply." };

  const idCheck = replyIdSchema.safeParse(input?.replyId);
  if (!idCheck.success) return { ok: false, message: "That reply no longer exists." };
  const replyId = idCheck.data;

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [row] = await db
    .select({
      suggestionId: schema.suggestionReplies.suggestionId,
      authorId: schema.suggestionReplies.userId,
      deletedAt: schema.suggestionReplies.deletedAt,
      locked: schema.suggestions.locked,
    })
    .from(schema.suggestionReplies)
    .innerJoin(schema.suggestions, eq(schema.suggestions.id, schema.suggestionReplies.suggestionId))
    .where(eq(schema.suggestionReplies.id, replyId))
    .limit(1);
  if (!row) return { ok: false, message: "That reply no longer exists." };

  const canModerate = await canManageSuggestions(session, userId);
  const actor: ReplyActor = { userId, role: session.role, canModerate };
  const thread: ThreadState = { locked: Boolean(row.locked) };
  const reply: ReplySubject = { authorId: row.authorId, deletedAt: toIsoOrNull(row.deletedAt) };

  if (!canEditReply(thread, reply, actor)) {
    return {
      ok: false,
      message: thread.locked ? "This thread is locked." : "You can only edit your own reply.",
    };
  }

  const parsed = editReplySchema.safeParse({ replyId, body: input?.body });
  if (!parsed.success) return { ok: false, message: "Your reply must be between 1 and 4000 characters." };

  try {
    // The "edited" marker is data, not a UI guess: editedAt is always set here,
    // on every successful edit, never inferred from the client. Ownership and
    // the not-deleted check are repeated in the WHERE itself (not just the
    // canEditReply check above) as defence in depth against a soft-delete
    // landing between the read and this write.
    await db
      .update(schema.suggestionReplies)
      .set({ body: parsed.data.body, editedAt: new Date() })
      .where(
        and(
          eq(schema.suggestionReplies.id, replyId),
          eq(schema.suggestionReplies.userId, userId),
          isNull(schema.suggestionReplies.deletedAt),
        ),
      );
  } catch (error) {
    console.error("Failed to edit suggestion reply", error);
    return { ok: false, message: "Failed to save your edit." };
  }

  refreshSuggestionPages(row.suggestionId);
  return { ok: true, message: "Reply updated." };
}

/**
 * Soft-deletes a reply: sets `deletedAt` and nothing else. This never issues
 * a SQL DELETE — the row stays in place so the thread keeps its shape, and
 * `replyBody()` in suggestions-rules.ts renders the tombstone in its place.
 *
 * `canDeleteReply` lets a moderator remove any reply (even in a locked
 * thread) or an author remove their own (only while unlocked).
 */
export async function deleteSuggestionReplyAction(input: { replyId: string }): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in to delete a reply." };

  const idCheck = replyIdSchema.safeParse(input?.replyId);
  if (!idCheck.success) return { ok: false, message: "That reply no longer exists." };
  const replyId = idCheck.data;

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [row] = await db
    .select({
      suggestionId: schema.suggestionReplies.suggestionId,
      authorId: schema.suggestionReplies.userId,
      deletedAt: schema.suggestionReplies.deletedAt,
      locked: schema.suggestions.locked,
    })
    .from(schema.suggestionReplies)
    .innerJoin(schema.suggestions, eq(schema.suggestions.id, schema.suggestionReplies.suggestionId))
    .where(eq(schema.suggestionReplies.id, replyId))
    .limit(1);
  if (!row) return { ok: false, message: "That reply no longer exists." };

  const canModerate = await canManageSuggestions(session, userId);
  const actor: ReplyActor = { userId, role: session.role, canModerate };
  const thread: ThreadState = { locked: Boolean(row.locked) };
  const reply: ReplySubject = { authorId: row.authorId, deletedAt: toIsoOrNull(row.deletedAt) };

  if (!canDeleteReply(thread, reply, actor)) {
    return {
      ok: false,
      message: reply.deletedAt ? "That reply was already removed." : "You cannot delete that reply.",
    };
  }

  const moderated = row.authorId !== userId;

  try {
    // Soft delete only, never DELETE. The isNull guard makes this idempotent
    // against a concurrent double-submit racing to the same row.
    await db
      .update(schema.suggestionReplies)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.suggestionReplies.id, replyId), isNull(schema.suggestionReplies.deletedAt)));

    // Staff removing someone else's words is a moderation event and gets an
    // audit trail, same as every other moderation action in this codebase.
    // An author removing their own reply is not moderation and stays quiet.
    if (moderated) {
      await db.insert(schema.auditLogs).values({
        actorId: userId,
        action: "suggestions.reply.delete",
        targetType: "reply",
        // `by` is what the audit reader (data/audit.ts) shows as the actor;
        // without it a moderation removal renders with a blank actor and an
        // empty summary. Every other moderation row in this codebase sets it.
        metadata: { by: session.username, suggestionId: row.suggestionId, authorId: row.authorId, moderated: true },
      });
    }
  } catch (error) {
    console.error("Failed to delete suggestion reply", error);
    return { ok: false, message: "Failed to delete that reply." };
  }

  // Storage cleanup for the reply's images. The read model already refuses to
  // show a tombstoned reply's images (and canDeleteReply never re-offers a
  // remove control once deletedAt is set), so nothing is lost by removing
  // them here — but without this the storage objects stay live on a public
  // bucket forever, which matters most on exactly the path that removes a
  // reported/abusive image. Never allowed to fail the reply removal itself.
  try {
    const orphaned = await db
      .select({ storageKey: schema.suggestionImages.storageKey })
      .from(schema.suggestionImages)
      .where(eq(schema.suggestionImages.replyId, replyId));
    if (orphaned.length) {
      await db.delete(schema.suggestionImages).where(eq(schema.suggestionImages.replyId, replyId));
      await Promise.all(orphaned.map((image) => removeSuggestionImageObject(image.storageKey)));
    }
  } catch (error) {
    console.error("Failed to clean up images for deleted suggestion reply", error);
  }

  refreshSuggestionPages(row.suggestionId);
  return { ok: true, message: "Reply removed." };
}

/**
 * Toggles the caller's vote on a suggestion.
 *
 * This never auto-votes anyone: it only ever acts on the signed-in caller's
 * own row, and only in direct response to this call. The insert relies on
 * `.onConflictDoNothing()` against the `suggestion_votes_unique_voter` unique
 * index (migration 038) as the real guard against a double vote — the
 * existence check below is just what decides which branch (vote / un-vote) to
 * take, not what prevents duplicates.
 */
export async function toggleSuggestionVoteAction(input: { suggestionId: string }): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in to vote." };

  const idCheck = suggestionIdSchema.safeParse(input?.suggestionId);
  if (!idCheck.success) return { ok: false, message: "That suggestion no longer exists." };
  const suggestionId = idCheck.data;

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [suggestion] = await db
    .select({ id: schema.suggestions.id })
    .from(schema.suggestions)
    .where(eq(schema.suggestions.id, suggestionId))
    .limit(1);
  if (!suggestion) return { ok: false, message: "That suggestion no longer exists." };

  const actor: ReplyActor = { userId, role: session.role, canModerate: await canManageSuggestions(session, userId) };
  if (!canVote(actor)) return { ok: false, message: "You must be signed in to vote." };

  // suggestionId was already validated by suggestionIdSchema above (idCheck),
  // so there is nothing left here that a second Zod parse could catch.

  const limit = await rateLimitShared(await actionClientKey("suggestion-vote", userId), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many votes. Wait a moment and try again." };

  try {
    const [existing] = await db
      .select({ id: schema.suggestionVotes.id })
      .from(schema.suggestionVotes)
      .where(and(eq(schema.suggestionVotes.suggestionId, suggestionId), eq(schema.suggestionVotes.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(schema.suggestionVotes).where(eq(schema.suggestionVotes.id, existing.id));
      refreshSuggestionPages(suggestionId);
      return { ok: true, message: "Vote removed." };
    }

    await db
      .insert(schema.suggestionVotes)
      .values({ suggestionId, userId })
      .onConflictDoNothing({ target: [schema.suggestionVotes.suggestionId, schema.suggestionVotes.userId] });
    refreshSuggestionPages(suggestionId);
    return { ok: true, message: "Vote added." };
  } catch (error) {
    console.error("Failed to toggle suggestion vote", error);
    return { ok: false, message: "Failed to update your vote." };
  }
}

/**
 * Locks or unlocks a thread. Staff-only, gated on `canManageSuggestions` (the
 * configurable SUGGESTIONS_PERMISSION_KEY — never a hardcoded role check),
 * and every change lands an `auditLogs` row.
 */
export async function setSuggestionLockedAction(input: { suggestionId: string; locked: boolean }): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "Not authorized." };

  const allowed = await canManageSuggestions(session, userId);
  if (!allowed) return { ok: false, message: "You don't have permission to manage suggestions." };

  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That suggestion no longer exists." };

  const limit = await rateLimitShared(await actionClientKey("suggestion-lock", userId), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "Too many changes. Wait a moment and try again." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const [updated] = await db
      .update(schema.suggestions)
      .set({ locked: parsed.data.locked, updatedAt: new Date() })
      .where(eq(schema.suggestions.id, parsed.data.suggestionId))
      .returning({ id: schema.suggestions.id, title: schema.suggestions.title });
    if (!updated) return { ok: false, message: "That suggestion no longer exists." };

    await db.insert(schema.auditLogs).values({
      actorId: userId,
      action: "suggestions.lock",
      targetType: "suggestion",
      targetId: parsed.data.suggestionId,
      metadata: { locked: parsed.data.locked, title: updated.title, by: session.username },
    });

    refreshSuggestionPages(parsed.data.suggestionId);
    return { ok: true, message: parsed.data.locked ? "Thread locked." : "Thread unlocked." };
  } catch (error) {
    console.error("Failed to update thread lock", error);
    return { ok: false, message: "Failed to update the thread." };
  }
}

/**
 * Removes one attached image.
 *
 * Allowed for the member who attached it and for anyone who passes
 * `canManageSuggestions` — images are reportable content, so staff need a way
 * to take one down without deleting the whole post around it.
 *
 * An owner delete additionally requires the thread to be unlocked, matching
 * `canDeleteReply`/`canEditReply`: once a thread is locked pending
 * moderation, an author can no longer edit the words around an image, so
 * they must not be able to strip the image either. A staff delete is not
 * affected by lock state — moderators must be able to act on locked threads.
 */
export async function deleteSuggestionImageAction(input: { imageId: string }): Promise<Result> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in." };

  const idCheck = z.string().uuid().safeParse(input?.imageId);
  if (!idCheck.success) return { ok: false, message: "That image no longer exists." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const [image] = await db
    .select({
      id: schema.suggestionImages.id,
      ownerId: schema.suggestionImages.userId,
      storageKey: schema.suggestionImages.storageKey,
      suggestionId: schema.suggestionImages.suggestionId,
      replyId: schema.suggestionImages.replyId,
    })
    .from(schema.suggestionImages)
    .where(eq(schema.suggestionImages.id, idCheck.data))
    .limit(1);
  if (!image) return { ok: false, message: "That image no longer exists." };

  const canModerate = await canManageSuggestions(session, userId);
  const moderated = image.ownerId !== userId;
  if (moderated && !canModerate) {
    return { ok: false, message: "You can only remove your own images." };
  }

  // Resolve the thread id (needed to revalidate either way) and its lock
  // state (needed for the owner-lock refusal below) before any write. A
  // top-level image resolves directly; a reply image has to join through
  // its reply to reach the suggestion.
  let threadId: string | null = null;
  let locked = false;
  if (image.suggestionId) {
    const [suggestion] = await db
      .select({ id: schema.suggestions.id, locked: schema.suggestions.locked })
      .from(schema.suggestions)
      .where(eq(schema.suggestions.id, image.suggestionId))
      .limit(1);
    threadId = suggestion?.id ?? null;
    locked = Boolean(suggestion?.locked);
  } else if (image.replyId) {
    const [row] = await db
      .select({ suggestionId: schema.suggestionReplies.suggestionId, locked: schema.suggestions.locked })
      .from(schema.suggestionReplies)
      .innerJoin(schema.suggestions, eq(schema.suggestions.id, schema.suggestionReplies.suggestionId))
      .where(eq(schema.suggestionReplies.id, image.replyId))
      .limit(1);
    threadId = row?.suggestionId ?? null;
    locked = Boolean(row?.locked);
  }

  if (!moderated && locked) {
    return { ok: false, message: "This thread is locked." };
  }

  try {
    // Audit before the destructive delete: a moderation action must never
    // lose its trail while the row and storage object are already gone.
    if (moderated) {
      await db.insert(schema.auditLogs).values({
        actorId: userId,
        action: "suggestions.image.delete",
        targetType: "suggestion_image",
        metadata: { by: session.username, imageId: image.id, ownerId: image.ownerId, moderated: true },
      });
    }

    await db.delete(schema.suggestionImages).where(eq(schema.suggestionImages.id, image.id));
    await removeSuggestionImageObject(image.storageKey);
  } catch (error) {
    console.error("Failed to delete suggestion image", error);
    return { ok: false, message: "Failed to remove that image." };
  }

  if (threadId) refreshSuggestionPages(threadId);

  return { ok: true, message: "Image removed." };
}
