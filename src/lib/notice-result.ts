/**
 * Turn the independent outcomes of "send a notice" into one honest message.
 *
 * Sending a notice can now do two things — deliver a DM and change a site rank
 * — and they succeed or fail separately. The operator must never read a
 * success line for work that did not happen: a promotion where the DM landed
 * but the rank did not is a FAILURE to report, not a success with a footnote.
 *
 * Pure, so the wording of every combination is pinned by tests rather than
 * discovered in production.
 */

export interface RankOutcome {
  ok: boolean;
  /** The rank that was requested. */
  to: string;
  /** Why it failed, taken verbatim from the rank action. */
  reason?: string;
}

export interface NoticeResultInput {
  delivered: boolean;
  /** Null when no rank change was requested. */
  rank: RankOutcome | null;
}

const DM_FAILED = "Discord refused the DM. They may have direct messages disabled.";

export function composeNoticeResult(input: NoticeResultInput): { ok: boolean; message: string } {
  const { delivered, rank } = input;

  if (!rank) {
    return delivered ? { ok: true, message: "Notice sent." } : { ok: false, message: DM_FAILED };
  }

  if (delivered && rank.ok) {
    return { ok: true, message: `Notice sent and rank set to ${rank.to}.` };
  }

  if (delivered && !rank.ok) {
    return {
      ok: false,
      message: `Notice sent, but the rank was not changed: ${rank.reason ?? "the rank change failed."}`,
    };
  }

  if (!delivered && rank.ok) {
    return { ok: false, message: `Rank set to ${rank.to}, but the DM could not be delivered.` };
  }

  return {
    ok: false,
    message: `The DM could not be delivered and the rank was not changed: ${rank.reason ?? "the rank change failed."}`,
  };
}
