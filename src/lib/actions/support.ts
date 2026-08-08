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

  // Signing in is not on its own a brake: without this one account could file
  // unlimited tickets/appeals/reports, flooding the staff queue and amplifying
  // database writes. One shared budget across every support form, bucketed per
  // account, so filing a ticket and then a bug report still works.
  const throttled = await throttleAuthAction("support-submit", {
    limit: 6,
    windowMs: 10 * 60_000,
    identity: session.username,
  });
  if (throttled) return { ok: false, message: throttled };

  if (isSupabaseConfigured()) {
    const userId = await getSessionUserId();
    if (!userId) {
      return { ok: false, message: "Your session has expired. Please sign in again." };
    }
    return { userId };
  }
  return { userId: null };
}

const ticketSchema = z.object({
  subject: z.string().min(4, "Give your ticket a clear subject."),
  category: z.string().min(1, "Choose a category."),
  priority: z.string().min(1, "Choose a priority."),
  message: z.string().min(10, "Describe your issue in a little more detail."),
});

const reportPlayerSchema = z.object({
  reportedUsername: z.string().min(3, "Enter the reported player's username."),
  category: z.string().min(1, "Choose a category."),
  description: z.string().min(20, "Describe what happened (min 20 chars)."),
  evidenceUrl: z.string().url("Enter a valid URL.").optional().or(z.literal("")),
});

const bugSchema = z.object({
  title: z.string().min(4, "Give the bug a short title."),
  gameMode: z.string().optional(),
  description: z.string().min(20, "Describe the bug (min 20 chars)."),
  reproductionSteps: z.string().optional(),
  minecraftVersion: z.string().optional(),
  evidenceUrl: z.string().url("Enter a valid URL.").optional().or(z.literal("")),
});

const suggestionSchema = z.object({
  title: z.string().min(4, "Give your idea a short title."),
  category: z.string().min(1, "Choose a category."),
  description: z.string().min(20, "Explain your idea (min 20 chars)."),
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

export async function submitTicket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = ticketSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const saved = await persist(async () => {
    const db = getDb()!;
    const [ticket] = await db
      .insert(schema.supportTickets)
      .values({ userId: auth.userId!, subject: parsed.data.subject, category: parsed.data.category, priority: parsed.data.priority })
      .returning();
    if (ticket) {
      await db.insert(schema.ticketMessages).values({ ticketId: ticket.id, senderId: auth.userId!, message: parsed.data.message });
    }
  });
  if (!saved) return { ok: false, message: SAVE_FAILED };
  return { ok: true, message: "Ticket opened. Our team will reply soon." };
}

export async function submitPlayerReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = reportPlayerSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const saved = await persist(async () =>
    getDb()!.insert(schema.playerReports).values({
      reporterId: auth.userId!,
      reportedUsername: parsed.data.reportedUsername,
      category: parsed.data.category,
      description: parsed.data.description,
      evidenceUrl: parsed.data.evidenceUrl || null,
    }),
  );
  if (!saved) return { ok: false, message: SAVE_FAILED };
  return { ok: true, message: "Report submitted. Only you and staff can see it. Thank you." };
}

export async function submitBugReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = bugSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const saved = await persist(async () =>
    getDb()!.insert(schema.bugReports).values({
      userId: auth.userId!,
      title: parsed.data.title,
      gameMode: parsed.data.gameMode || null,
      description: parsed.data.description,
      reproductionSteps: parsed.data.reproductionSteps || null,
      minecraftVersion: parsed.data.minecraftVersion || null,
      evidenceUrl: parsed.data.evidenceUrl || null,
    }),
  );
  if (!saved) return { ok: false, message: SAVE_FAILED };
  return { ok: true, message: "Bug reported. Thanks for helping us squash it." };
}

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
