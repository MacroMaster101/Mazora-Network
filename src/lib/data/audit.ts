import "server-only";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

/**
 * Audit trail reader.
 *
 * Rows are written by the privileged actions themselves (role changes, user
 * deletions, news edits, store changes). The metadata shape differs per action,
 * so it is normalised here into a headline the page can render without knowing
 * about every action type — new actions show up readably without a code change.
 */

export interface AuditEntry {
  id: string;
  action: string;
  /** Coarse family used for grouping and colour: "user", "news", "store"… */
  category: string;
  actor: string | null;
  target: string | null;
  /** One-line description built from whatever metadata the action recorded. */
  summary: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Builds a readable line from the metadata an action happened to record. */
function summarise(action: string, meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const subject = str(meta.username) ?? str(meta.email) ?? str(meta.title) ?? str(meta.slug);

  if (action === "role.change") {
    const from = str(meta.from);
    const to = str(meta.to);
    if (from && to) return `${subject ?? "account"}: ${from} → ${to}`;
  }
  if (action.startsWith("user.")) {
    const role = str(meta.role);
    return [subject, role ? `(${role})` : null].filter(Boolean).join(" ");
  }
  if (action === "news.sync") {
    const imported = meta.imported ?? 0;
    const skipped = meta.skipped ?? 0;
    return `${imported} imported, ${skipped} skipped`;
  }
  return subject ?? "";
}

export async function getAuditEntries(limit = 200): Promise<AuditEntry[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit);

    return rows.map((row) => {
      const meta = asRecord(row.metadata);
      return {
        id: row.id,
        action: row.action,
        category: row.action.split(".")[0] ?? "other",
        actor: str(meta?.by),
        target: row.targetId,
        summary: summarise(row.action, meta),
        createdAt: row.createdAt.toISOString(),
        metadata: meta,
      };
    });
  } catch (error) {
    console.error("Failed to load audit entries:", error);
    return [];
  }
}
