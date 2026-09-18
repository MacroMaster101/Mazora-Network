import "server-only";
import { getDb, schema } from "@/lib/db/client";

/**
 * Tell someone that a post answered them: the topic's author for a top-level
 * reply, or the author of the post that was answered for a nested one.
 *
 * Swallows its own errors on purpose: the reply is already committed by the
 * time this runs, and a failed notification must never surface as a failed
 * post — that invites a retry which would double-post. Self-replies are
 * skipped rather than notifying someone about their own words.
 */
export async function dispatchForumReplyNotification(input: {
  authorId: string;
  replierId: string;
  topicId: string;
  topicTitle: string;
  replierName: string;
  /** "post" when answering a specific post rather than the topic. */
  target?: "topic" | "post";
}): Promise<void> {
  const db = getDb();
  if (!db || !input.authorId || input.authorId === input.replierId) return;
  try {
    await db.insert(schema.notifications).values({
      userId: input.authorId,
      title: input.target === "post" ? "💬 New reply to your post" : "💬 New reply to your topic",
      message:
        input.target === "post"
          ? `${input.replierName} replied to your post in "${input.topicTitle}".`
          : `${input.replierName} replied to "${input.topicTitle}".`,
      // "support" is what the suggestions reply notification uses, and the
      // forums are reached from the Support Center. The column's live values are
      // security / support / system / welcome — do not invent a new one.
      category: "support",
      sender: "mazora",
      href: `/forums/topic/${input.topicId}`,
    });
  } catch (error) {
    console.error("Forum reply notification dispatch failed", error);
  }
}
