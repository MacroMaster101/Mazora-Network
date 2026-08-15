"use server";

/**
 * Rulebook management. Every action is gated to administrator+ (matching the
 * /admin/rules page), writes an audit log entry, and revalidates both the admin
 * screen and the public rulebook so an edit is visible immediately.
 */
import { eq, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, hasAtLeast } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";

export interface RuleActionResult {
  ok: boolean;
  message: string;
}

const DENIED: RuleActionResult = { ok: false, message: "You do not have permission to edit the rules." };
const NO_DB: RuleActionResult = { ok: false, message: "The database is not connected." };

/** Shared guard: returns the editor's username, or null when not permitted. */
async function requireEditor(): Promise<string | null> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return null;
  return session.username;
}

async function audit(action: string, targetId: string, metadata: Record<string, unknown>) {
  const db = getDb();
  if (!db) return;
  await db.insert(schema.auditLogs).values({
    action,
    targetType: "rule",
    targetId,
    metadata,
  });
}

function refresh() {
  revalidatePath("/admin/rules");
  revalidatePath("/rules");
}

function clean(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Update a single rule's title and body. */
export async function saveRuleAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  const title = clean(formData.get("title"), 160);
  const description = clean(formData.get("description"), 1000);
  if (!id) return { ok: false, message: "Missing rule." };
  if (!title) return { ok: false, message: "A rule needs a title." };

  await db.update(schema.rules).set({ title, description }).where(eq(schema.rules.id, id));
  await audit("rule.update", id, { title, by });
  refresh();
  return { ok: true, message: "Rule saved." };
}

/** Add a rule to the end of a category. */
export async function addRuleAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const categoryId = clean(formData.get("categoryId"), 64);
  const title = clean(formData.get("title"), 160);
  const description = clean(formData.get("description"), 1000);
  if (!categoryId) return { ok: false, message: "Missing category." };
  if (!title) return { ok: false, message: "A rule needs a title." };

  const [{ next }] = await db
    .select({ next: raw<number>`coalesce(max(${schema.rules.sortOrder}) + 1, 0)` })
    .from(schema.rules)
    .where(eq(schema.rules.categoryId, categoryId));

  const [row] = await db
    .insert(schema.rules)
    .values({ categoryId, title, description, sortOrder: Number(next) ?? 0, enabled: true })
    .returning({ id: schema.rules.id });

  await audit("rule.create", row?.id ?? categoryId, { title, by });
  refresh();
  return { ok: true, message: "Rule added." };
}

/** Remove a rule outright. */
export async function deleteRuleAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  if (!id) return { ok: false, message: "Missing rule." };

  const [existing] = await db
    .select({ title: schema.rules.title })
    .from(schema.rules)
    .where(eq(schema.rules.id, id))
    .limit(1);

  await db.delete(schema.rules).where(eq(schema.rules.id, id));
  await audit("rule.delete", id, { title: existing?.title ?? null, by });
  refresh();
  return { ok: true, message: "Rule deleted." };
}

/** Show or hide a rule without deleting it. */
export async function toggleRuleAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  const enabled = clean(formData.get("enabled"), 8) === "true";
  if (!id) return { ok: false, message: "Missing rule." };

  await db.update(schema.rules).set({ enabled }).where(eq(schema.rules.id, id));
  await audit("rule.visibility", id, { enabled, by });
  refresh();
  return { ok: true, message: enabled ? "Rule is now public." : "Rule hidden from the public page." };
}

/** Rename a category or change its icon. */
export async function saveCategoryAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  const name = clean(formData.get("name"), 80);
  const icon = clean(formData.get("icon"), 40);
  if (!id) return { ok: false, message: "Missing category." };
  if (!name) return { ok: false, message: "A category needs a name." };

  await db
    .update(schema.ruleCategories)
    .set({ name, icon: icon || null, updatedAt: new Date() })
    .where(eq(schema.ruleCategories.id, id));
  await audit("rule.category.update", id, { name, icon, by });
  refresh();
  return { ok: true, message: "Category saved." };
}

/** Create a category. The slug is derived from the name and must be unique. */
export async function addCategoryAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const name = clean(formData.get("name"), 80);
  const icon = clean(formData.get("icon"), 40) || "Shield";
  if (!name) return { ok: false, message: "A category needs a name." };

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!slug) return { ok: false, message: "That name cannot be turned into a web address." };

  const [clash] = await db
    .select({ id: schema.ruleCategories.id })
    .from(schema.ruleCategories)
    .where(eq(schema.ruleCategories.slug, slug))
    .limit(1);
  if (clash) return { ok: false, message: "A category with that name already exists." };

  const [{ next }] = await db
    .select({ next: raw<number>`coalesce(max(${schema.ruleCategories.sortOrder}) + 1, 0)` })
    .from(schema.ruleCategories);

  const [row] = await db
    .insert(schema.ruleCategories)
    .values({ name, slug, icon, sortOrder: Number(next) ?? 0 })
    .returning({ id: schema.ruleCategories.id });

  await audit("rule.category.create", row?.id ?? slug, { name, slug, by });
  refresh();
  return { ok: true, message: `Category “${name}” created.` };
}

/** Delete a category and every rule inside it. */
export async function deleteCategoryAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  if (!id) return { ok: false, message: "Missing category." };

  const [existing] = await db
    .select({ name: schema.ruleCategories.name })
    .from(schema.ruleCategories)
    .where(eq(schema.ruleCategories.id, id))
    .limit(1);

  const removed = await db.delete(schema.rules).where(eq(schema.rules.categoryId, id)).returning({ id: schema.rules.id });
  await db.delete(schema.ruleCategories).where(eq(schema.ruleCategories.id, id));

  await audit("rule.category.delete", id, { name: existing?.name ?? null, rulesRemoved: removed.length, by });
  refresh();
  return {
    ok: true,
    message: `Deleted “${existing?.name ?? "category"}” and ${removed.length} rule${removed.length === 1 ? "" : "s"}.`,
  };
}

/** Move a rule up or down within its category. */
export async function reorderRuleAction(formData: FormData): Promise<RuleActionResult> {
  const by = await requireEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  const direction = clean(formData.get("direction"), 8);
  if (!id || (direction !== "up" && direction !== "down")) return { ok: false, message: "Missing move." };

  const [current] = await db.select().from(schema.rules).where(eq(schema.rules.id, id)).limit(1);
  if (!current) return { ok: false, message: "Rule not found." };

  const siblings = await db
    .select()
    .from(schema.rules)
    .where(eq(schema.rules.categoryId, current.categoryId))
    .orderBy(schema.rules.sortOrder);

  const index = siblings.findIndex((r) => r.id === id);
  const swapWith = direction === "up" ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return { ok: true, message: "Already at the end." };

  /*
    Both halves of the swap, or neither. Unwrapped, a failure between them left
    two rules sharing one sort_order and the list silently ordered by whatever
    Postgres returned for the tie.
  */
  await db.transaction(async (tx) => {
    await tx.update(schema.rules).set({ sortOrder: swapWith.sortOrder }).where(eq(schema.rules.id, current.id));
    await tx.update(schema.rules).set({ sortOrder: current.sortOrder }).where(eq(schema.rules.id, swapWith.id));
  });

  await audit("rule.reorder", id, { direction, by });
  refresh();
  return { ok: true, message: "Order updated." };
}
