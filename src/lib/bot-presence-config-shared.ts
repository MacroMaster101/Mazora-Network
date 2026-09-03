export const MIN_ROTATE_MS = 5_000;
export const MIN_REFRESH_MS = 30_000;
export const MAX_ROTATE_MS = 600_000;
export const MAX_REFRESH_MS = 3_600_000;

export const ACTIVITY_TYPES = ["Playing", "Watching", "Listening", "Competing"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const DEFAULT_KINDS = ["website", "minecraft", "discord"] as const;
export type StatusKind = (typeof DEFAULT_KINDS)[number] | "custom";

export interface PresenceStatusRow {
  id: string;
  kind: StatusKind;
  template: string;
  fallbackTemplate: string | null;
  activityType: ActivityType;
  enabled: boolean;
}

export interface BotPresenceConfig {
  statuses: PresenceStatusRow[];
  rotateMs: number;
  refreshMs: number;
}

export const DEFAULT_BOT_PRESENCE: BotPresenceConfig = {
  statuses: [
    {
      id: "website",
      kind: "website",
      template: "🌐 mazora.us • {site_status}",
      fallbackTemplate: "🌐 mazora.us • Offline",
      activityType: "Playing",
      enabled: true,
    },
    {
      id: "minecraft",
      kind: "minecraft",
      template: "⛏️ mc.mazora.us • {mc_players}/{mc_max}",
      fallbackTemplate: "⛏️ mc.mazora.us • Offline",
      activityType: "Watching",
      enabled: true,
    },
    {
      id: "discord",
      kind: "discord",
      template: "🟣 Discord • {discord_online} online ({discord_members} members)",
      fallbackTemplate: "🟣 Discord • Count unavailable",
      activityType: "Watching",
      enabled: true,
    },
  ],
  rotateMs: 5_000,
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

const TOKEN_PATTERN = /\{([a-z_]+)\}/g;
export const DEFAULT_TOKEN_RULES = {
  website: { required: ["site_status"], allowed: ["site_status"] },
  minecraft: { required: ["mc_players", "mc_max"], allowed: ["mc_players", "mc_max"] },
  // Member count is an optional display enhancement. Online count is the
  // truthful minimum the built-in Discord status must keep.
  discord: {
    required: ["discord_online"],
    allowed: ["discord_online", "discord_members"],
  },
} as const satisfies Record<
  (typeof DEFAULT_KINDS)[number],
  { required: readonly string[]; allowed: readonly string[] }
>;

function tokensIn(...templates: Array<string | null>): Set<string> {
  const tokens = new Set<string>();
  for (const template of templates) {
    for (const match of template?.matchAll(TOKEN_PATTERN) ?? []) tokens.add(match[1]);
  }
  return tokens;
}

export function hasValidDefaultTokens(row: PresenceStatusRow): boolean {
  if (row.kind === "custom") return true;
  const actual = tokensIn(row.template, row.fallbackTemplate);
  const rule = DEFAULT_TOKEN_RULES[row.kind];
  return (
    rule.required.every((token) => actual.has(token)) &&
    [...actual].every((token) => (rule.allowed as readonly string[]).includes(token))
  );
}

function sanitiseRow(value: unknown, index: number): PresenceStatusRow | null {
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
  };
}

export function sanitiseBotPresence(value: unknown): BotPresenceConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULT_BOT_PRESENCE);
  }
  const stored = value as Partial<BotPresenceConfig>;
  const parsedRows = Array.isArray(stored.statuses)
    ? stored.statuses.map(sanitiseRow).filter((row): row is PresenceStatusRow => row !== null)
    : [];

  // Stored JSON is not assumed to have come through the admin action. Enforce
  // the protected-row invariants here too so a direct or legacy database write
  // cannot duplicate a default, change its id/token set, or make React keys
  // collide in the dashboard.
  const seenDefaultKinds = new Set<string>();
  const seenIds = new Set<string>();
  const rows: PresenceStatusRow[] = [];
  for (const parsedRow of parsedRows) {
    let row = parsedRow;
    if (row.kind !== "custom") {
      if (seenDefaultKinds.has(row.kind)) continue;
      seenDefaultKinds.add(row.kind);
      const fallback = DEFAULT_BOT_PRESENCE.statuses.find((candidate) => candidate.kind === row.kind)!;
      row = hasValidDefaultTokens(row)
        ? { ...row, id: row.kind }
        : { ...row, id: row.kind, template: fallback.template, fallbackTemplate: fallback.fallbackTemplate };
      if (row.kind === "website" && row.fallbackTemplate === null) {
        row = { ...row, fallbackTemplate: fallback.fallbackTemplate };
      }
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
    rotateMs: clamp(stored.rotateMs, MIN_ROTATE_MS, MAX_ROTATE_MS, DEFAULT_BOT_PRESENCE.rotateMs),
    refreshMs: clamp(stored.refreshMs, MIN_REFRESH_MS, MAX_REFRESH_MS, DEFAULT_BOT_PRESENCE.refreshMs),
  };
}
