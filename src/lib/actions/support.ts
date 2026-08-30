"use server";

import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { throttleAuthAction } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as schema from "@/lib/db/schema";
import { storeSuggestionImages, storeSuggestionImagesFromUrls } from "@/lib/suggestions/image-store";
import { attachmentCountError, filesFromFormData, imageSizeError, urlsFromFormData } from "@/lib/suggestion-image-rules";

export interface ActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Shared guard: every support submission requires a signed-in user.
 *
 * `userId` is the real Supabase auth id when a database is configured (so rows
 * are attributed to the actual submitter, never a shared placeholder). In demo
 * mode there is no backing DB and `userId` is null; the persist step below
 * treats that as a no-op success so the scaffolds stay explorable.
 */
async function requireUser(): Promise<{ userId: string | null } | ActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "You need to be logged in to submit this form." };
  }

  const userId = isSupabaseConfigured() ? await getSessionUserId() : null;
  if (isSupabaseConfigured() && !userId) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  // Signing in is not on its own a brake: without this one account could file
  // unlimited tickets/appeals/reports, flooding the staff queue and amplifying
  // database writes. One shared budget across every support form, bucketed per
  // account, so filing a ticket and then a bug report still works.
  const throttled = await throttleAuthAction("support-submit", {
    limit: 6,
    windowMs: 10 * 60_000,
    // Supabase id is immutable; an editable display/IGN-derived username is
    // not a stable per-account throttle key.
    identity: userId ?? session.username,
  });
  if (throttled) return { ok: false, message: throttled };

  return { userId };
}

const suggestionSchema = z.object({
  title: z.string().trim().min(4, "Give your idea a short title.").max(160, "Keep the title under 160 characters."),
  category: z.string().trim().min(1, "Choose a category.").max(60, "That category is too long."),
  description: z.string().trim().min(20, "Explain your idea (min 20 chars).").max(10_000, "Keep the description under 10,000 characters."),
});

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((v, k) => (out[k] = typeof v === "string" ? v : ""));
  return out;
}

/**
 * Persist a submission. Returns true on success. When no database is configured
 * (demo mode) there is nothing to write, which is a legitimate success. When a
 * database IS configured and the write throws, the failure is surfaced (logged
 * and reported false) so the caller never claims a submission was saved when it
 * was not.
 */
async function persist(run: () => Promise<unknown>): Promise<boolean> {
  const db = getDb();
  if (!db) return true; // demo mode: no DB, nothing to persist
  try {
    await run();
    return true;
  } catch (error) {
    console.error("Support submission failed to persist", error);
    return false;
  }
}

const SAVE_FAILED = "We couldn't save your submission. Please try again shortly.";

/*
  submitTicket / submitPlayerReport / submitBugReport were removed: the pages
  that consumed them (/support/ticket, /support/report-player,
  /support/report-bug) were rewritten as Discord-handoff guides and no longer
  post a form. Only the suggestions flow still submits on-site.
*/
export async function submitSuggestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = suggestionSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  // Pure input validation: refuse an over-cap batch BEFORE anything is written,
  // so a member never sees a failure message for a suggestion that was in fact
  // created. (Storage failures below are different — those come after the save
  // and must never roll it back.)
  const files = filesFromFormData(formData, "images");
  const imageUrls = urlsFromFormData(formData, "imageUrls");
  const countError = attachmentCountError(files.length, imageUrls.length);
  if (countError) return { ok: false, message: countError };
  for (const file of files) {
    const sizeError = imageSizeError(file.size);
    if (sizeError) return { ok: false, message: sizeError };
  }

  let suggestionId: string | undefined;
  const saved = await persist(async () => {
    const [row] = await getDb()!
      .insert(schema.suggestions)
      .values({
        userId: auth.userId!,
        title: parsed.data.title,
        category: parsed.data.category,
        description: parsed.data.description,
      })
      .returning({ id: schema.suggestions.id });
    suggestionId = row?.id;
  });
  if (!saved) return { ok: false, message: SAVE_FAILED };

  // Images are attached after the suggestion is saved and never roll it back:
  // losing someone's written idea because one attachment was malformed is the
  // worse failure. A rejected file is reported in the message instead.
  const requestedImages = files.length + imageUrls.length;
  let attached = 0;
  let attachFailed = false;
  if (suggestionId && (files.length || imageUrls.length)) {
    const target = { kind: "suggestion" as const, id: suggestionId };
    const uploaded = await storeSuggestionImages(files, target);
    // Links continue the sort order after the uploads, so a post mixing
    // both keeps them in the order the member gave them.
    const linked = await storeSuggestionImagesFromUrls(imageUrls, target, uploaded.length);
    const stored = [...uploaded, ...linked];
    if (stored.length) {
      try {
        await getDb()!
          .insert(schema.suggestionImages)
          .values(
            stored.map((image) => ({
              suggestionId,
              userId: auth.userId!,
              url: image.url,
              storageKey: image.storageKey,
              sortOrder: image.sortOrder,
            })),
          );
        attached = stored.length;
      } catch (error) {
        // The suggestion itself is already committed above; a failure here
        // (dropped connection, FK issue) must not surface as a failed
        // submission — that would invite a duplicate retry of a suggestion
        // that is already live. Log, leave `attached` at 0 so imageNote
        // reports honestly, and fall through to the success return. These
        // files DID pass validation (storeSuggestionImages already accepted
        // them) — this is a server fault, not a bad-file problem, so the
        // message below must not blame the member's files for it.
        console.error("Failed to attach images to suggestion", error);
        attachFailed = true;
      }
    }
  }

  const imageNote = attachFailed
    ? ` We couldn't save your images because of a server error — please try attaching them again.`
    : requestedImages && attached < requestedImages
      ? ` ${attached} of ${requestedImages} images were attached — the rest could not be read.`
      : "";
  return { ok: true, message: `Suggestion submitted. The community can vote on it soon.${imageNote}` };
}
