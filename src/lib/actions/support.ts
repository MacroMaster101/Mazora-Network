"use server";

import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { throttleAuthAction } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as schema from "@/lib/db/schema";

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
  const saved = await persist(async () =>
    getDb()!.insert(schema.suggestions).values({
      userId: auth.userId!,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
    }),
  );
  if (!saved) return { ok: false, message: SAVE_FAILED };
  return { ok: true, message: "Suggestion submitted. The community can vote on it soon." };
}
