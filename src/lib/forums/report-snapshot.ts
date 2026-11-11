import { BODY_MAX } from "@/lib/forums-rules";

/**
 * What a forum report keeps of the post it is about (migration 090).
 *
 * An author can edit a post after it has been reported, so the report records
 * the text as it was when it was filed, and the staff queue shows that text
 * whenever it is no longer what the post says. Pure: shared by the report
 * action, the staff queue and the tests.
 */

/**
 * The text stored on a report: the post body, bounded to the most a post body
 * may hold. Counted in characters (code points), the way the database's
 * `char_length` check counts them, so a surrogate pair is never split.
 */
export function reportSnapshot(body: string): string {
  const characters = Array.from(body);
  return characters.length > BODY_MAX ? characters.slice(0, BODY_MAX).join("") : body;
}

export interface ReportedText {
  /** The post's text when these reports were filed. */
  text: string;
  /** When the first report carrying this text was filed. */
  reportedAt: string;
  /** Who filed reports carrying this text, earliest first. */
  reporters: string[];
}

/**
 * The texts staff were asked to review that the post no longer says, oldest
 * first, one entry per distinct text. Reports with no snapshot (filed before
 * migration 090) and reports whose text still matches the post add nothing.
 */
export function textsChangedSinceReported(
  reports: readonly { createdAt: string; reporter: string; reportedBody: string | null }[],
  currentBody: string,
): ReportedText[] {
  const byText = new Map<string, ReportedText>();
  const ordered = [...reports].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const report of ordered) {
    if (report.reportedBody === null || report.reportedBody === currentBody) continue;
    const entry = byText.get(report.reportedBody);
    if (entry) entry.reporters.push(report.reporter);
    else byText.set(report.reportedBody, { text: report.reportedBody, reportedAt: report.createdAt, reporters: [report.reporter] });
  }
  return [...byText.values()];
}

/**
 * True when a database error is Postgres saying that `column` does not exist
 * (SQLSTATE 42703): the code is running ahead of the migration that adds it.
 * The driver's error may be wrapped by Drizzle, so the cause chain is walked,
 * as databaseConnectionErrorCode does for connection errors. The column name
 * must appear in the message, so an unrelated missing column is not mistaken
 * for this one and still fails loudly.
 */
export function isMissingColumnError(error: unknown, column: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const value = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (value.code === "42703" && typeof value.message === "string" && value.message.includes(`"${column}"`)) return true;
    current = value.cause;
  }
  return false;
}
