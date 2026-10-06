/**
 * Readable subjects for audit log rows: the pure rules, with no database or
 * server-only imports, so they are unit tested directly. The reader that loads
 * rows and looks up ids lives in src/lib/data/audit.ts.
 */

type Meta = Record<string, unknown> | null;

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** A name from a before/after snapshot ({ name } or { label }). */
function snapshotName(meta: Meta): string | null {
  for (const key of ["after", "before"] as const) {
    const snap = asRecord(meta?.[key]);
    const name = str(snap?.name) ?? str(snap?.label) ?? str(snap?.title);
    if (name) return name;
  }
  return null;
}

export const TYPE_LABEL: Record<string, string> = {
  user: "User",
  news: "News article",
  event: "Event",
  product: "Store product",
  game_mode: "Game mode",
  creator_code: "Creator code",
  content_creator: "Content creator",
  order: "Order",
  suggestion: "Suggestion",
  setting: "Setting",
  role: "Rank",
  mfa_factor: "Two-step verification",
  broadcast: "Broadcast",
  audience: "Broadcast",
  template: "Notification template",
  forum_post: "Forum post",
  discord_user: "Discord member",
  rule: "Rule",
};

/** "survival-smp" → "Survival SMP": words capitalised, short ones (SMP, PvP) upper-cased. */
function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** "store.featured_picks" → "Store featured picks"; known settings get their page name. */
function settingLabel(key: string | null): string | null {
  if (!key) return null;
  const known: Record<string, string> = {
    "site.general": "Site settings",
  };
  if (known[key]) return known[key];
  const words = key.replace(/[._]/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** Builds the readable subject from what the action recorded. */
export function summarise(action: string, targetType: string | null, targetId: string | null, meta: Meta): string | null {
  const person = str(meta?.username) ?? str(meta?.email);
  const title = str(meta?.title) ?? str(meta?.name);

  if (action === "role.change" || action === "roles.assign") {
    const from = str(meta?.from);
    const to = str(meta?.to);
    if (from && to) return `${person ?? "account"}: ${from} → ${to}`;
  }
  if (action === "user.delete") {
    // Deletions keep the username; rows written while it was briefly dropped have none.
    const rank = str(meta?.deletedRole) ?? str(meta?.role);
    return person ? `${person}${rank ? ` (${rank})` : ""}` : `Deleted account${rank ? ` (${rank})` : ""}`;
  }
  if (action === "news.sync") {
    return `${meta?.imported ?? 0} imported, ${meta?.skipped ?? 0} skipped`;
  }
  if (action === "staff.notice") {
    const template = str(meta?.customTitle) ?? str(meta?.template);
    return person ? `${person}${template ? `: ${template}` : ""}` : template;
  }
  if (action.startsWith("auth.two_factor")) {
    if (action === "auth.two_factor_recovery_used") {
      const left = typeof meta?.remaining === "number" ? meta.remaining : null;
      return `Recovery code used${left !== null ? ` (${left} left)` : ""}`;
    }
    const verb = action.slice("auth.two_factor_".length);
    return `Authenticator app ${verb}`;
  }
  if (action.startsWith("auth.passkey")) return action.endsWith("removed") ? "Passkey removed" : "Passkey added";
  if (targetType === "creator_code") {
    const code = str(meta?.code);
    const creator = str(meta?.creatorName);
    if (code) return creator ? `${code} (${creator})` : code;
  }
  if (targetType === "order") {
    const ref = str(meta?.reference);
    const invoice = str(meta?.invoiceNo);
    if (invoice) return `Invoice ${invoice}${ref ? ` for ${ref}` : ""}`;
    if (ref) return `Order ${ref}`;
  }
  if (targetType === "discord_user") {
    return meta?.granted === false ? "Discord role removed" : "Discord role given";
  }
  if (targetType === "forum_post") {
    const count = typeof meta?.count === "number" ? meta.count : null;
    return `Forum post report${count && count > 1 ? `s (${count})` : ""}`;
  }
  if (targetType === "role") {
    const role = meta?.role;
    return str(role) ?? str(asRecord(role)?.label) ?? str(asRecord(role)?.key) ?? str(targetId);
  }
  if (targetType === "setting") {
    // Store categories are keyed "game-mode:Category[:Subcategory]".
    if (targetId?.includes(":")) {
      const [mode, ...path] = targetId.split(":");
      return `${path.join(" › ")} (${titleCase(mode ?? "")})`;
    }
    return settingLabel(targetId) ?? snapshotName(meta);
  }
  if (targetType === "suggestion" && title) {
    const status = str(meta?.status);
    return status ? `${title} (${status})` : title;
  }
  return person ?? title ?? snapshotName(meta) ?? str(meta?.code) ?? str(meta?.slug);
}
