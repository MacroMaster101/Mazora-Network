import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export type TemplateCategory = "welcome" | "system" | "support" | "security" | "announcement" | "event";
export type TemplateSender = "mazora" | "staff" | "system";
export type TemplateDelivery = "website" | "website_email";

export interface NotificationTemplate {
  id: string;
  name: string;
  triggerNote: string;
  title: string;
  message: string;
  category: TemplateCategory;
  sender: TemplateSender;
  delivery: TemplateDelivery;
  /** Fires automatically from an auth flow; cannot be dispatched by hand. */
  fixed: boolean;
  enabled: boolean;
  sortOrder: number;
}

/** The template that greets a newly verified account. */
export const WELCOME_TEMPLATE_ID = "tpl-welcome";
/** The template confirming a verified login session. */
export const SESSION_TEMPLATE_ID = "tpl-security";

/**
 * Mirrors the seed rows in migration 037. Used as the read fallback so the
 * admin screen and the auto-dispatch keep working before that migration has
 * been applied, or when DATABASE_URL is unset.
 */
export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: WELCOME_TEMPLATE_ID,
    name: "New Player Welcome Message",
    triggerNote:
      "Automatically sent on first login via Website + Email. This is a fixed default — it cannot be manually dispatched and is delivered to every new user.",
    title: "🎉 Welcome to Mazora Network",
    message:
      "Your account is active. Connect to mc.mazora.us to claim your starter pack and explore survival mode!",
    category: "welcome",
    sender: "mazora",
    delivery: "website_email",
    fixed: true,
    enabled: true,
    sortOrder: 10,
  },
  {
    id: SESSION_TEMPLATE_ID,
    name: "Account Session Verification",
    triggerNote:
      "Automatically sent on first login or new device session via Website only. Fixed default — fires automatically.",
    title: "🔒 Session Verification",
    message:
      "Your login session was verified successfully. If you suspect unauthorized activity, change your password in account settings.",
    category: "security",
    sender: "mazora",
    delivery: "website",
    fixed: true,
    enabled: true,
    sortOrder: 20,
  },
  {
    id: "tpl-form",
    name: "Form Response / Staff Application Result",
    triggerNote:
      "Admin dispatches manually after reviewing Google Form staff applications or other user submissions.",
    title: "📋 Staff Form Application Update",
    message:
      "Your application form submission has been reviewed by the administrative team. Check Discord for next steps!",
    category: "support",
    sender: "mazora",
    delivery: "website",
    fixed: false,
    enabled: true,
    sortOrder: 30,
  },
  {
    id: "tpl-ticket",
    name: "Support Ticket Status Update / Staff Reply",
    triggerNote: "Admin dispatches manually when staff responds to or resolves a ticket thread.",
    title: "🎫 Support Ticket Update",
    message: "A staff member has updated your ticket status. Click here to view the full response.",
    category: "support",
    sender: "mazora",
    delivery: "website",
    fixed: false,
    enabled: true,
    sortOrder: 40,
  },
  {
    id: "tpl-appeal",
    name: "Ban Appeal Decision Notice",
    triggerNote: "Admin dispatches manually when an appeal is approved, rejected, or updated.",
    title: "🛡️ Appeal Review Notice",
    message: "Your punishment appeal has been reviewed by staff. Click to view the decision details.",
    category: "support",
    sender: "mazora",
    delivery: "website",
    fixed: false,
    enabled: true,
    sortOrder: 50,
  },
  {
    id: "tpl-store",
    name: "Store Package & Rank Delivery",
    triggerNote: "Admin dispatches manually when a store purchase or vote reward is processed.",
    title: "🛒 Store Package Delivered",
    message: "Your rank, keys, and perks have been assigned to your connected Minecraft account!",
    category: "system",
    sender: "mazora",
    delivery: "website",
    fixed: false,
    enabled: true,
    sortOrder: 60,
  },
];

type TemplateRow = typeof schema.notificationTemplates.$inferSelect;

function toTemplate(row: TemplateRow): NotificationTemplate {
  return {
    id: row.id,
    name: row.name,
    triggerNote: row.triggerNote,
    title: row.title,
    message: row.message,
    category: row.category as TemplateCategory,
    sender: row.sender as TemplateSender,
    delivery: row.delivery as TemplateDelivery,
    fixed: row.fixed,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

/**
 * Every default template, lowest sort order first. Falls back to the built-in
 * defaults when the table is missing or empty so the module degrades to its
 * previous behaviour rather than rendering nothing.
 */
export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  const db = getDb();
  if (!db) return DEFAULT_NOTIFICATION_TEMPLATES.map((t) => ({ ...t }));
  try {
    const rows = await db
      .select()
      .from(schema.notificationTemplates)
      .orderBy(asc(schema.notificationTemplates.sortOrder));
    if (rows.length === 0) return DEFAULT_NOTIFICATION_TEMPLATES.map((t) => ({ ...t }));
    return rows.map(toTemplate);
  } catch (error) {
    console.error("Notification template list failed", error);
    return DEFAULT_NOTIFICATION_TEMPLATES.map((t) => ({ ...t }));
  }
}

export async function getNotificationTemplate(id: string): Promise<NotificationTemplate | null> {
  const db = getDb();
  const fallback = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.id === id) ?? null;
  if (!db) return fallback ? { ...fallback } : null;
  try {
    const [row] = await db
      .select()
      .from(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.id, id))
      .limit(1);
    return row ? toTemplate(row) : fallback ? { ...fallback } : null;
  } catch (error) {
    console.error("Notification template read failed", error);
    return fallback ? { ...fallback } : null;
  }
}

/**
 * Updates a template's editable fields. Fixed templates allow only their text
 * to change — their id, category, and trigger are part of the auth wiring.
 */
export async function updateNotificationTemplate(
  id: string,
  patch: { title?: string; message?: string; enabled?: boolean },
): Promise<NotificationTemplate | null> {
  const db = getDb();
  if (!db) throw new Error("The database is not connected.");

  // Seed the row on first write when migration 037 inserted nothing for it.
  const fallback = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.id === id);
  if (fallback) {
    await db
      .insert(schema.notificationTemplates)
      .values({
        id: fallback.id,
        name: fallback.name,
        triggerNote: fallback.triggerNote,
        title: fallback.title,
        message: fallback.message,
        category: fallback.category,
        sender: fallback.sender,
        delivery: fallback.delivery,
        fixed: fallback.fixed,
        enabled: fallback.enabled,
        sortOrder: fallback.sortOrder,
      })
      .onConflictDoNothing({ target: schema.notificationTemplates.id });
  }

  const set: Partial<TemplateRow> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.message !== undefined) set.message = patch.message;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;

  const [row] = await db
    .update(schema.notificationTemplates)
    .set(set)
    .where(eq(schema.notificationTemplates.id, id))
    .returning();
  return row ? toTemplate(row) : null;
}
