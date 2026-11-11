import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BODY_MAX } from "@/lib/forums-rules";
import { isMissingColumnError, reportSnapshot, textsChangedSinceReported } from "@/lib/forums/report-snapshot";

/*
  A forum report keeps the post's text as it was when reported (migration
  090), and the staff queue shows it when the post has been edited since. The
  action, the loader and the schema are checked from source; the rules they
  share are run for real.
*/

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
/** Source with comments removed, so an assertion cannot be met by prose. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

const migration = read("../../../supabase/migrations/090_forum_report_snapshot.sql");
const flat = migration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

test("the stored text is bounded to the longest post body, by character", () => {
  assert.equal(reportSnapshot("Please deliver to Steve_42"), "Please deliver to Steve_42");
  assert.equal(reportSnapshot("a".repeat(BODY_MAX)), "a".repeat(BODY_MAX));
  assert.equal(reportSnapshot("a".repeat(BODY_MAX + 5)), "a".repeat(BODY_MAX));
  // Counted as the database's char_length counts: an emoji is one character, never split.
  const emoji = "\u{1F600}";
  const long = emoji.repeat(BODY_MAX + 1);
  assert.equal(Array.from(reportSnapshot(long)).length, BODY_MAX);
  assert.equal(reportSnapshot(long), emoji.repeat(BODY_MAX));
});

test("only text the post no longer says is shown, once per distinct text, oldest first", () => {
  const current = "Nice build, Alex_Builder.";
  const reports = [
    { createdAt: "2026-03-02T10:00:00.000Z", reporter: "StaffAlex", reportedBody: "Second version" },
    { createdAt: "2026-03-01T10:00:00.000Z", reporter: "Steve_42", reportedBody: "First version" },
    { createdAt: "2026-03-03T10:00:00.000Z", reporter: "Example_Player", reportedBody: "First version" },
    { createdAt: "2026-03-04T10:00:00.000Z", reporter: "Alex_Builder", reportedBody: current },
    { createdAt: "2026-02-01T10:00:00.000Z", reporter: "Old_Reporter", reportedBody: null },
  ];
  assert.deepEqual(textsChangedSinceReported(reports, current), [
    { text: "First version", reportedAt: "2026-03-01T10:00:00.000Z", reporters: ["Steve_42", "Example_Player"] },
    { text: "Second version", reportedAt: "2026-03-02T10:00:00.000Z", reporters: ["StaffAlex"] },
  ]);
  // Unedited, or reported before 090: nothing to show.
  assert.deepEqual(textsChangedSinceReported([{ ...reports[3] }], current), []);
  assert.deepEqual(textsChangedSinceReported([{ ...reports[4] }], current), []);
});

test("a missing snapshot column is recognised through Drizzle's wrapper, and nothing else is", () => {
  const driver = Object.assign(new Error('column "reported_body" of relation "forum_reports" does not exist'), { code: "42703" });
  const wrapped = Object.assign(new Error("Failed query: insert into ..."), { cause: driver });
  assert.equal(isMissingColumnError(driver, "reported_body"), true);
  assert.equal(isMissingColumnError(wrapped, "reported_body"), true);

  const otherColumn = Object.assign(new Error('column "note" does not exist'), { code: "42703" });
  assert.equal(isMissingColumnError(otherColumn, "reported_body"), false);
  const otherError = Object.assign(new Error('duplicate key violates "reported_body"'), { code: "23505" });
  assert.equal(isMissingColumnError(otherError, "reported_body"), false);
  assert.equal(isMissingColumnError(null, "reported_body"), false);
  assert.equal(isMissingColumnError("reported_body", "reported_body"), false);
});

test("090 adds a bounded, nullable column, idempotently, in one transaction", () => {
  assert.match(flat, /^\s*begin; set local lock_timeout = '5s';/);
  assert.match(flat, /commit;\s*$/);
  assert.match(flat, /alter table public\.forum_reports add column if not exists reported_body text;/);
  assert.doesNotMatch(flat, /reported_body text not null/);
  assert.match(flat, /drop constraint if exists forum_reports_reported_body_length;/);
  assert.match(
    flat,
    /add constraint forum_reports_reported_body_length check \(reported_body is null or char_length\(reported_body\) <= 8000\);/,
  );
  // The SQL bound is the same number as the post body's.
  assert.equal(BODY_MAX, 8000);
});

test("the reports table stays closed to the Data API, the new column included", () => {
  // RLS has been on since 046, with no policy, so PostgREST serves no row of it.
  const forums046 = read("../../../supabase/migrations/046_forums.sql").replace(/--[^\n]*/g, "");
  assert.match(forums046, /alter table public\.forum_reports enable row level security;/);
  for (const name of ["046_forums.sql", "050_forum_report_notes.sql", "090_forum_report_snapshot.sql"]) {
    const sql = read(`../../../supabase/migrations/${name}`).replace(/--[^\n]*/g, "");
    assert.doesNotMatch(sql, /create policy[^;]*forum_reports/i, name);
    assert.doesNotMatch(sql, /disable row level security/i, name);
  }
  // 090 adds no policy and no grant, and repeats 046's write revoke.
  assert.match(flat, /revoke insert, update, delete on public\.forum_reports from anon, authenticated;/);
  assert.doesNotMatch(flat, /create policy|grant |disable row level security/i);
});

test("the schema declares the column", () => {
  const schema = code("../db/schema.ts");
  const table = schema.slice(schema.indexOf('export const forumReports = pgTable("forum_reports"'), schema.indexOf("export const forumPostVotes"));
  assert.match(table, /reportedBody: text\("reported_body"\),/);
});

test("reporting records the text, and still files the report before 090 is applied", () => {
  const forums = code("../actions/forums.ts");
  const report = forums.slice(forums.indexOf("export async function reportForumPostAction"), forums.indexOf("export async function voteOnForumPostAction"));

  // The text comes from the database row, never the form.
  assert.match(report, /body: schema\.forumPosts\.body,/);
  assert.match(report, /\.values\(\{ \.\.\.report, reportedBody: reportSnapshot\(post\.body\) \}\)\s*\.onConflictDoNothing\(\)/);
  assert.doesNotMatch(report, /input\.body|formData/);

  // Only the missing column falls back; any other error still fails the report.
  assert.match(report, /if \(!isMissingColumnError\(error, "reported_body"\)\) throw error;/);
  assert.match(
    report,
    /insert into \$\{schema\.forumReports\} \(post_id, reporter_id, reason, note\)\s*values \(\$\{report\.postId\}, \$\{report\.reporterId\}, \$\{report\.reason\}, \$\{report\.note\}\)\s*on conflict do nothing\s*returning id/,
  );
  // Both paths keep the duplicate-report answer.
  assert.match(report, /if \(!inserted\.length\) return \{ ok: true, message: "You have already reported this post\." \};/);
});

test("the queue reads the snapshot apart from its main query, so a missing column cannot empty it", () => {
  const data = code("../data/forum-reports.ts");
  const list = data.slice(data.indexOf("export async function listOpenForumReports"), data.indexOf("async function reportedBodies"));
  const main = list.slice(list.indexOf(".select({"), list.indexOf(".orderBy(desc(schema.forumReports.createdAt))"));
  assert.ok(main.length > 0);
  assert.doesNotMatch(main, /reportedBody/);
  assert.match(list, /const snapshots = await reportedBodies\(db, rows\.map\(\(row\) => row\.id\)\);/);
  assert.match(list, /reportedBody: snapshots\.get\(row\.id\) \?\? null,/);

  const loader = data.slice(data.indexOf("async function reportedBodies"), data.indexOf("export async function openReportCountsByForum"));
  assert.match(loader, /\.where\(and\(inArray\(schema\.forumReports\.id, reportIds\), isNotNull\(schema\.forumReports\.reportedBody\)\)\);/);
  assert.match(loader, /catch \(error\) \{[\s\S]*return new Map\(\);\s*\}/);
});

test("the snapshot is shown only on the staff page that already requires the forums module", () => {
  // The loader's one caller is the reports page, which checks the module first.
  const page = code("../../app/admin/forums/reports/page.tsx");
  assert.match(page, /await requireModuleAccess\(FORUMS_PERMISSION_KEY, "\/admin\/forums\/reports"\);/);
  assert.ok(page.indexOf("requireModuleAccess(") < page.indexOf("listOpenForumReports("));
});

test("staff see the reported text as plain text, labelled as what was reported", () => {
  const queue = code("../../components/admin/forum-reports-queue.tsx");
  assert.match(queue, /const reportedTexts = textsChangedSinceReported\(postReports, post\.body\);/);
  assert.match(queue, /Edited since it was reported\. The text that was reported:/);
  assert.match(queue, /<p className="whitespace-pre-line text-sm leading-relaxed text-ink\/90">\{reported\.text\}<\/p>/);
  assert.doesNotMatch(queue, /dangerouslySetInnerHTML/);
});
