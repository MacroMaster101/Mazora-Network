import type { Role } from "@/lib/types";

export const REPORT_REASONS = ["spam", "abuse", "off_topic", "duplicate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  abuse: "Abuse or harassment",
  off_topic: "Off topic",
  duplicate: "Duplicate of another suggestion",
  other: "Something else",
};

export interface ReportActor {
  userId: string | null;
  role: Role | null;
}

export interface ReportTarget {
  authorId: string;
  deletedAt: string | null;
}

/**
 * Whether `actor` may report `target`.
 *
 * "Already reported" is deliberately NOT checked here: it is enforced by the
 * partial unique indexes in migration 039. A rule that has to query the
 * database is not a pure rule and could not be unit-tested with the rest.
 */
export function canReport(target: ReportTarget, actor: ReportActor): boolean {
  if (actor.userId === null) return false;
  if (target.deletedAt) return false;
  return actor.userId !== target.authorId;
}
