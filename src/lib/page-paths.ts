/**
 * Editable page identity, kept free of every other import.
 *
 * The edge middleware needs the public path of each editable page to scope the
 * admin preview relaxation. It cannot reach `page-content.ts` for them: that
 * module pulls in the permission keys, and with them the database client, none
 * of which belongs in the middleware bundle. So the ids and the path rule live
 * here, and `page-content.ts` builds its definitions on top.
 */
export const EDITABLE_PAGE_IDS = [
  "home", "news", "events", "game-modes", "rules", "gallery", "staff",
  "vote", "discord", "players", "leaderboards", "status",
] as const;

export type EditablePageId = (typeof EDITABLE_PAGE_IDS)[number];

export function isEditablePageId(value: string): value is EditablePageId {
  return (EDITABLE_PAGE_IDS as readonly string[]).includes(value);
}

/** The home page sits at the root; every other editor maps to its own slug. */
export function editablePagePath(id: EditablePageId): string {
  return id === "home" ? "/" : `/${id}`;
}

/**
 * The only paths on which `?adminPreview=1` may relax `frame-ancestors`. A
 * drift test asserts this matches the `path` on every page definition.
 */
export const EDITABLE_PAGE_PATHS: ReadonlySet<string> = new Set(
  EDITABLE_PAGE_IDS.map(editablePagePath),
);
