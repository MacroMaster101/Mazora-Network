export const MIN_ROTATE_MS = 5_000;
export const MIN_REFRESH_MS = 30_000;
/** Larger delays overflow Node's timer and are reduced to 1ms. */
export const MAX_TIMER_MS = 2_147_483_647;

export const REMOTE_ACTIVITY_TYPES = ["Playing", "Watching", "Listening", "Competing"] as const;
export type RemoteActivityType = (typeof REMOTE_ACTIVITY_TYPES)[number];

export interface RemoteStatus {
  id: string;
  kind: string;
  template: string;
  fallbackTemplate: string | null;
  activityType: RemoteActivityType;
  enabled: boolean;
}

export interface RemoteConfig {
  statuses: RemoteStatus[];
  rotateMs: number;
  refreshMs: number;
}

export function clampPresenceInterval(value: unknown, minimum: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_TIMER_MS, Math.max(minimum, Math.floor(parsed)));
}

/**
 * Turn the dashboard response into a configuration safe for the worker.
 *
 * The website sanitises this payload too, but these limits belong at the point
 * of use: a bad database write or a future endpoint regression must not make
 * Discord receive presence updates faster than its documented allowance.
 */
export function parseRemoteConfig(value: unknown): RemoteConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Partial<RemoteConfig>;
  if (!Array.isArray(candidate.statuses)) return null;

  const statuses = candidate.statuses
    .map((value, index): RemoteStatus | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const row = value as Partial<RemoteStatus>;
      if (typeof row.template !== "string" || !row.template.trim()) return null;

      const activityType = REMOTE_ACTIVITY_TYPES.includes(row.activityType as RemoteActivityType)
        ? (row.activityType as RemoteActivityType)
        : "Playing";

      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim().slice(0, 64)
            : `status-${index}`,
        kind: typeof row.kind === "string" ? row.kind : "custom",
        template: row.template.trim().slice(0, 128),
        fallbackTemplate:
          typeof row.fallbackTemplate === "string" && row.fallbackTemplate.trim()
            ? row.fallbackTemplate.trim().slice(0, 128)
            : null,
        activityType,
        enabled: row.enabled !== false,
      };
    })
    .filter((status): status is RemoteStatus => status !== null)
    .slice(0, 20);

  if (statuses.length === 0) return null;

  return {
    statuses,
    rotateMs: clampPresenceInterval(candidate.rotateMs, MIN_ROTATE_MS, MIN_ROTATE_MS),
    refreshMs: clampPresenceInterval(candidate.refreshMs, MIN_REFRESH_MS, MIN_REFRESH_MS),
  };
}
