/**
 * Pure retention rules for the audit-log reaper — no server-only dependencies,
 * so the rule is unit tested directly. The reaper that deletes lives in
 * src/lib/data/cleanup-audit-logs.ts.
 *
 * Nothing pruned audit_logs before this existed, so the table only ever grew.
 * It is already the second-largest table in the public schema, and it is the
 * only one that grows purely as a function of staff activity with nothing
 * bounding it: every publish, every price edit, every category toggle is a row,
 * kept forever.
 *
 * At current size this is not a storage problem — the whole database is 15 MB,
 * of which actual row data is under 1 MB. It is written now because an
 * append-only table is cheapest to bound before it is large, and because the
 * cost of getting it wrong later is deleting history someone needed.
 */

/** How long an ordinary audit entry is kept. */
export const AUDIT_LOG_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Actions that are never aged out, whatever the TTL says.
 *
 * An audit trail exists to answer questions asked long after the fact — who
 * removed this account, who granted this person staff, who revoked it. Those
 * are exactly the questions that arrive years later, from a dispute or a data
 * request, and exactly the rows a plain age cutoff would delete first.
 *
 * The list is deliberately short. Everything on it changes who can do what, or
 * destroys something a person may later ask about; routine content edits are
 * not on it and should not be added. Keeping everything forever would make this
 * module pointless, so each addition has to earn its place.
 */
export const PERMANENT_AUDIT_ACTIONS: ReadonlySet<string> = new Set([
  "role.change",
  "user.delete",
  "user.invite",
  "user.invite.revoke",
  "order.delete",
]);

/** The subset of an audit row the retention rule reads. */
export interface RetainableAuditLog {
  id: string;
  action: string;
  createdAt: string | Date;
}

function millis(value: string | Date | null | undefined): number {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Which audit entries a retention run should delete: older than `ttlMs`, and
 * not on the permanent list.
 *
 * A row whose timestamp cannot be read is kept. There are only two ways to
 * treat an unparseable date, and deleting on a NaN comparison would take out
 * either everything or nothing depending on which way the operator falls —
 * neither is a decision anyone made on purpose.
 *
 * The boundary is exclusive: an entry exactly `ttlMs` old survives. Off-by-one
 * here quietly shortens the retention period, and the rows are gone before
 * anybody notices the window was a day short.
 */
export function selectExpiredAuditLogs<T extends RetainableAuditLog>(
  entries: T[],
  now: number,
  ttlMs: number,
): T[] {
  const cutoff = now - ttlMs;
  return entries.filter((entry) => {
    if (PERMANENT_AUDIT_ACTIONS.has(entry.action)) return false;
    const created = millis(entry.createdAt);
    return Number.isFinite(created) && created < cutoff;
  });
}
