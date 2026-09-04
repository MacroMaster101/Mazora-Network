export const MIN_ROTATE_MS = 5_000;
export const MIN_REFRESH_MS = 30_000;
export const MAX_ROTATE_MS = 600_000;
export const MAX_REFRESH_MS = 3_600_000;

/**
 * Hold time given to a newly added status.
 *
 * Discord allows five presence updates per twenty seconds. Five is therefore
 * both the floor and the sensible starting point — anything shorter would be
 * dropped by Discord rather than displayed faster.
 */
export const DEFAULT_HOLD_MS = 5_000;

export const ACTIVITY_TYPES = ["Playing", "Watching", "Listening", "Competing"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const DEFAULT_KINDS = ["website", "minecraft", "discord"] as const;
export type DefaultKind = (typeof DEFAULT_KINDS)[number];
export type StatusKind = DefaultKind | "custom";

export interface PresenceStatusRow {
  id: string;
  kind: StatusKind;
  template: string;
  fallbackTemplate: string | null;
  activityType: ActivityType;
  enabled: boolean;
  /**
   * How long this one status stays on screen before the loop moves on.
   *
   * Per-row rather than global because the lines are not equally worth
   * reading: a player count rewards a longer look than a static "Live".
   */
  holdMs: number;
}

export interface BotPresenceConfig {
  statuses: PresenceStatusRow[];
  /**
   * Hold time handed to newly added statuses, and the value a row inherits if
   * it was stored before per-status timing existed. Rotation itself is driven
   * by each row's own holdMs.
   */
  rotateMs: number;
  refreshMs: number;
}

/**
 * The two sanctioned Discord lines.
 *
 * How much detail to show is a display choice, so both are offered. Neither
 * changes what the line claims, which is why the pair can stay switchable
 * while free-text editing of the default is closed off.
 */
export const DISCORD_TEMPLATES = {
  online: "🟣 Discord • {discord_online} online",
  members: "🟣 Discord • {discord_online} online ({discord_members} members)",
} as const;

export const DEFAULT_BOT_PRESENCE: BotPresenceConfig = {
  statuses: [
    {
      id: "website",
      kind: "website",
      template: "🌐 mazora.us • {site_status}",
      fallbackTemplate: "🌐 mazora.us • Offline",
      activityType: "Playing",
      enabled: true,
      holdMs: 5_000,
    },
    {
      id: "minecraft",
      kind: "minecraft",
      template: "⛏️ mc.mazora.us • {mc_players}/{mc_max}",
      fallbackTemplate: "⛏️ mc.mazora.us • Offline",
      activityType: "Watching",
      enabled: true,
      // The player count is the line people actually read, so it gets longer.
      holdMs: 10_000,
    },
    {
      id: "discord",
      kind: "discord",
      template: DISCORD_TEMPLATES.members,
      fallbackTemplate: "🟣 Discord • Count unavailable",
      activityType: "Watching",
      enabled: true,
      holdMs: 5_000,
    },
  ],
  rotateMs: DEFAULT_HOLD_MS,
  refreshMs: 60_000,
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, number));
};

const text = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 128) : fallback;

const idText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 64) : fallback;

const defaultRow = (kind: DefaultKind): PresenceStatusRow =>
  DEFAULT_BOT_PRESENCE.statuses.find((row) => row.kind === kind)!;

/**
 * The status text a default row is allowed to carry, canonical value first.
 *
 * The three built-in lines name real services and carry the tokens the worker
 * substitutes. Left as free text they could be rewritten into something that
 * still looked official while saying anything at all, so they are fixed, and
 * only the Discord pair varies.
 */
export function allowedTemplatesFor(kind: DefaultKind): readonly string[] {
  if (kind === "discord") return [DISCORD_TEMPLATES.members, DISCORD_TEMPLATES.online];
  return [defaultRow(kind).template];
}

/** The one fallback line a default row is allowed to carry. */
export function canonicalFallbackFor(kind: DefaultKind): string | null {
  return defaultRow(kind).fallbackTemplate;
}

/**
 * Whether a default row's text is something the dashboard could have produced.
 *
 * The fallback counts. It is what shows whenever live data is missing — which
 * is exactly when people look — so a locked default whose fallback could say
 * anything would not be locked in any way that mattered.
 */
export function hasLockedDefaultText(row: PresenceStatusRow): boolean {
  if (row.kind === "custom") return true;
  return (
    allowedTemplatesFor(row.kind).includes(row.template) &&
    row.fallbackTemplate === canonicalFallbackFor(row.kind)
  );
}

/** Force a default row back onto sanctioned text, keeping a legal variant. */
function lockDefaultText(row: PresenceStatusRow): PresenceStatusRow {
  if (row.kind === "custom") return row;
  const allowed = allowedTemplatesFor(row.kind);
  return {
    ...row,
    template: allowed.includes(row.template) ? row.template : allowed[0],
    fallbackTemplate: canonicalFallbackFor(row.kind),
  };
}

function sanitiseRow(value: unknown, index: number, fallbackHoldMs: number): PresenceStatusRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<PresenceStatusRow>;
  const kind: StatusKind =
    row.kind && (DEFAULT_KINDS as readonly string[]).concat("custom").includes(row.kind) ? row.kind : "custom";
  const template = text(row.template, "");
  if (!template) return null;

  return {
    id: idText(row.id, `status-${index}`),
    kind,
    template,
    fallbackTemplate:
      typeof row.fallbackTemplate === "string" && row.fallbackTemplate.trim()
        ? row.fallbackTemplate.trim().slice(0, 128)
        : null,
    activityType: ACTIVITY_TYPES.includes(row.activityType as ActivityType)
      ? (row.activityType as ActivityType)
      : "Playing",
    enabled: row.enabled !== false,
    // Rows written before per-status timing carry no holdMs and inherit the
    // old global interval, so an upgrade changes nothing visible.
    holdMs: clamp(row.holdMs, MIN_ROTATE_MS, MAX_ROTATE_MS, fallbackHoldMs),
  };
}

export function sanitiseBotPresence(value: unknown): BotPresenceConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULT_BOT_PRESENCE);
  }
  const stored = value as Partial<BotPresenceConfig>;
  const rotateMs = clamp(stored.rotateMs, MIN_ROTATE_MS, MAX_ROTATE_MS, DEFAULT_BOT_PRESENCE.rotateMs);
  const parsedRows = Array.isArray(stored.statuses)
    ? stored.statuses
        .map((row, index) => sanitiseRow(row, index, rotateMs))
        .filter((row): row is PresenceStatusRow => row !== null)
    : [];

  // Stored JSON is not assumed to have come through the admin action. Enforce
  // the protected-row invariants here too so a direct or legacy database write
  // cannot duplicate a default, rewrite its locked text, change its id, or make
  // React keys collide in the dashboard.
  const seenDefaultKinds = new Set<string>();
  const seenIds = new Set<string>();
  const rows: PresenceStatusRow[] = [];
  for (const parsedRow of parsedRows) {
    let row = parsedRow;
    if (row.kind !== "custom") {
      if (seenDefaultKinds.has(row.kind)) continue;
      seenDefaultKinds.add(row.kind);
      row = lockDefaultText({ ...row, id: row.kind });
    } else if ((DEFAULT_KINDS as readonly string[]).includes(row.id)) {
      row = { ...row, id: `${row.id}-custom` };
    }

    let id = row.id;
    for (let suffix = 2; seenIds.has(id); suffix += 1) {
      const ending = `-${suffix}`;
      id = `${row.id.slice(0, 64 - ending.length)}${ending}`;
    }
    seenIds.add(id);
    rows.push(id === row.id ? row : { ...row, id });
  }

  const present = new Set(rows.map((row) => row.kind));
  for (const fallbackRow of DEFAULT_BOT_PRESENCE.statuses) {
    if (!present.has(fallbackRow.kind)) rows.push({ ...fallbackRow });
  }

  // Defaults are mandatory and therefore count toward the 20-row wire limit.
  // Drop only trailing custom rows if malformed stored JSON would exceed it.
  while (rows.length > 20) {
    const customIndex = rows.findLastIndex((row) => row.kind === "custom");
    if (customIndex === -1) break;
    rows.splice(customIndex, 1);
  }

  return {
    statuses: rows.length ? rows : structuredClone(DEFAULT_BOT_PRESENCE.statuses),
    rotateMs,
    refreshMs: clamp(stored.refreshMs, MIN_REFRESH_MS, MAX_REFRESH_MS, DEFAULT_BOT_PRESENCE.refreshMs),
  };
}
