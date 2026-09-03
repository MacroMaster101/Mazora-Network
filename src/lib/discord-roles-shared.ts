/**
 * Shared snowflake-list parser.
 *
 * Extracted from getStoreStaffRoleIds' inline version so the grantable-role
 * allowlist cannot drift from it, and so the fail-closed behaviour is testable
 * without touching the environment.
 */
export function parseRoleIdList(raw: string | undefined): string[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  return [...new Set(trimmed.split(",").map((id) => id.trim()).filter((id) => /^\d{17,20}$/.test(id)))];
}
