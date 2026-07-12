"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
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

/** Shared guard: every support submission requires a signed-in user. */
async function requireUser(): Promise<{ userId: string } | ActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "You need to be logged in to submit this form." };
  }
  // Phase 1 sessions don't carry a DB user id; use a stable placeholder so the
  // insert path is valid. Phase 2 replaces this with the real auth user id.
  return { userId: "00000000-0000-4000-8000-000000000000" };
}

const ticketSchema = z.object({
  subject: z.string().min(4, "Give your ticket a clear subject."),
  category: z.string().min(1, "Choose a category."),
  priority: z.string().min(1, "Choose a priority."),
  message: z.string().min(10, "Describe your issue in a little more detail."),
});

const appealSchema = z.object({
  minecraftUsername: z.string().min(3, "Enter your Minecraft username."),
  punishmentType: z.string().min(1, "Select the punishment type."),
  punishmentReason: z.string().optional(),
  appealText: z.string().min(20, "Tell us why the punishment should be lifted (min 20 chars)."),
  evidenceUrl: z.string().url("Enter a valid URL.").optional().or(z.literal("")),
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

async function tryInsert(run: () => Promise<unknown>): Promise<void> {
  const db = getDb();
  if (!db) return; // demo mode: no DB, succeed without persisting
  try {
    await run();
  } catch {
    /* swallow in Phase 1 — surfaced properly once DB is wired */
  }
}

export async function submitTicket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = ticketSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  await tryInsert(async () => {
    const db = getDb()!;
    const [ticket] = await db
      .insert(schema.supportTickets)
      .values({ userId: auth.userId, subject: parsed.data.subject, category: parsed.data.category, priority: parsed.data.priority })
      .returning();
    if (ticket) {
      await db.insert(schema.ticketMessages).values({ ticketId: ticket.id, senderId: auth.userId, message: parsed.data.message });
    }
  });
  return { ok: true, message: "Ticket opened. Our team will reply soon." };
}

export async function submitAppeal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = appealSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  await tryInsert(async () =>
    getDb()!.insert(schema.banAppeals).values({
      userId: auth.userId,
      minecraftUsername: parsed.data.minecraftUsername,
      punishmentType: parsed.data.punishmentType,
      punishmentReason: parsed.data.punishmentReason || null,
      appealText: parsed.data.appealText,
      evidenceUrl: parsed.data.evidenceUrl || null,
    }),
  );
  return { ok: true, message: "Appeal submitted. You'll be notified when it's reviewed." };
}

export async function submitPlayerReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = reportPlayerSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  await tryInsert(async () =>
    getDb()!.insert(schema.playerReports).values({
      reporterId: auth.userId,
      reportedUsername: parsed.data.reportedUsername,
      category: parsed.data.category,
      description: parsed.data.description,
      evidenceUrl: parsed.data.evidenceUrl || null,
    }),
  );
  return { ok: true, message: "Report submitted. Only you and staff can see it. Thank you." };
}

export async function submitBugReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = bugSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  await tryInsert(async () =>
    getDb()!.insert(schema.bugReports).values({
      userId: auth.userId,
      title: parsed.data.title,
      gameMode: parsed.data.gameMode || null,
      description: parsed.data.description,
      reproductionSteps: parsed.data.reproductionSteps || null,
      minecraftVersion: parsed.data.minecraftVersion || null,
      evidenceUrl: parsed.data.evidenceUrl || null,
    }),
  );
  return { ok: true, message: "Bug reported. Thanks for helping us squash it." };
}

export async function submitSuggestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = suggestionSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  await tryInsert(async () =>
    getDb()!.insert(schema.suggestions).values({
      userId: auth.userId,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
    }),
  );
  return { ok: true, message: "Suggestion submitted. The community can vote on it soon." };
}
