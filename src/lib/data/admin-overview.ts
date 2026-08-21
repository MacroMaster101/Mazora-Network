/**
 * Data for the staff control room at /admin.
 *
 * Every loader reports where its numbers came from so the dashboard can be
 * honest about it: "live" (a real upstream API or a real database row), or
 * "scaffold" (the Phase-1 demo dataset). Anything that isn't wired up yet
 * returns null and is rendered as "awaiting database" rather than a zero,
 * because a fake 0 reads like a real, reassuring answer.
 */
import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import type { Role } from "@/lib/types";
import { ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAllAuthUsers } from "@/lib/data/accounts";
import { resolveAvatarUrl } from "@/lib/avatar-source";

export interface AccountRow {
  username: string;
  email: string;
  role: Role;
  createdAt: string;
  /** Chosen avatar, else the sign-in provider's photo, else null (monogram). */
  avatarUrl: string | null;
}

export interface AccountsSnapshot {
  total: number;
  newThisWeek: number;
  staffCount: number;
  recent: AccountRow[];
}

/** A rule as the admin editor needs it — with its id and hidden state. */
export interface EditableRule {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface EditableCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  updated: string;
  rules: EditableRule[];
}

export interface AuditRow {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  createdAt: string;
}

function toRole(value: unknown): Role {
  return typeof value === "string" && ROLES.includes(value as Role) ? (value as Role) : "member";
}

/**
 * Real registered accounts from Supabase Auth. Returns null when the service
 * role key isn't configured, so the caller can say so instead of showing 0.
 */
export async function getAccountsSnapshot(): Promise<AccountsSnapshot | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  // Paginated: the totals below are reported to the operator as account counts,
  // so a silently truncated first page made them wrong past 200 accounts.
  const { users: allUsers, error } = await listAllAuthUsers(admin);
  if (error) return null;
  const data = { users: allUsers };

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // This list is built from auth alone for speed, so it has no profile join and
  // therefore no chosen avatar. One extra read keeps the control room's faces
  // consistent with the Users board rather than falling back to a generic head.
  const chosenAvatars = new Map<string, string | null>();
  try {
    const { data: profiles } = await admin.from("profiles").select("user_id, avatar_url");
    for (const row of profiles ?? []) chosenAvatars.set(String(row.user_id), row.avatar_url ?? null);
  } catch {
    // Avatars are cosmetic here; a failure must not take out the whole snapshot.
  }

  const users = data.users.map((u) => ({
    username: String(u.user_metadata?.username ?? u.email?.split("@")[0] ?? "player"),
    email: u.email ?? "",
    role: toRole(u.app_metadata?.role),
    createdAt: u.created_at ?? "",
    avatarUrl: resolveAvatarUrl(
      chosenAvatars.get(u.id),
      u.identities?.find((identity) => identity.provider === "google")?.identity_data,
      u.user_metadata,
      ...(u.identities ?? [])
        .filter((identity) => identity.provider !== "google")
        .map((identity) => identity.identity_data),
    ),
  }));

  const staffRanked: Role[] = ["helper", "moderator", "senior_moderator", "administrator", "owner", "it"];
  return {
    total: users.length,
    newThisWeek: users.filter((u) => u.createdAt && new Date(u.createdAt).getTime() >= weekAgo).length,
    staffCount: users.filter((u) => staffRanked.includes(u.role)).length,
    recent: [...users]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
  };
}

/**
 * The rulebook as the admin editor needs it: row ids so edits can target a
 * specific rule, and hidden rules included so staff can bring them back. The
 * public getRules() intentionally exposes neither.
 */
export async function getEditableRules(): Promise<EditableCategory[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [categories, allRules] = await Promise.all([
      db.select().from(schema.ruleCategories).orderBy(asc(schema.ruleCategories.sortOrder)),
      db.select().from(schema.rules).orderBy(asc(schema.rules.sortOrder)),
    ]);

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon ?? "Shield",
      updated: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
      rules: allRules
        .filter((r) => r.categoryId === c.id)
        .map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          enabled: r.enabled,
        })),
    }));
  } catch (error) {
    console.error("Failed to load editable rules:", error);
    return null;
  }
}

/** Human-readable summary of an audit row's metadata. */
function describe(action: string, metadata: unknown): { target: string; detail: string } {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const username = typeof meta.username === "string" ? meta.username : "";
  if (action === "role.change") {
    const from = typeof meta.from === "string" ? meta.from : "?";
    const to = typeof meta.to === "string" ? meta.to : "?";
    return { target: username || "a user", detail: `${from} → ${to}` };
  }
  return { target: username || "—", detail: "" };
}

/**
 * The most recent privileged actions. Returns null when there's no database
 * connection — the audit trail is a security record, so an empty list and
 * "not recording" must not look the same.
 */
export async function getRecentAudit(limit = 6): Promise<AuditRow[] | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit);

    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const { target, detail } = describe(row.action, row.metadata);
      return {
        id: String(row.id),
        action: row.action,
        actor: typeof meta.by === "string" ? meta.by : "system",
        target,
        detail,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      };
    });
  } catch {
    return null;
  }
}

export interface AdminGalleryImage {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  category: string;
  authorName: string;
  status: "published" | "pending" | "rejected";
  featured: boolean;
  likesCount: number;
  createdAt: string;
}

export async function getAdminGallery(): Promise<AdminGalleryImage[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: schema.galleryImages.id,
        title: schema.galleryImages.title,
        description: schema.galleryImages.description,
        imageUrl: schema.galleryImages.imageUrl,
        thumbnailUrl: schema.galleryImages.thumbnailUrl,
        category: schema.galleryImages.category,
        authorName: schema.galleryImages.authorName,
        status: schema.galleryImages.status,
        featured: schema.galleryImages.featured,
        likesCount: schema.galleryImages.likesCount,
        createdAt: schema.galleryImages.createdAt,
        userMinecraft: schema.profiles.username,
      })
      .from(schema.galleryImages)
      .leftJoin(schema.profiles, eq(schema.galleryImages.authorId, schema.profiles.userId))
      .orderBy(desc(schema.galleryImages.createdAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl || r.imageUrl,
      category: r.category,
      authorName: r.userMinecraft || r.authorName || "Anonymous Player",
      status: (r.status as "published" | "pending" | "rejected") || "pending",
      featured: r.featured ?? false,
      likesCount: r.likesCount ?? 0,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  } catch (error) {
    console.error("Failed to load admin gallery:", error);
    return null;
  }
}
