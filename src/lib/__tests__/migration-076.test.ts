import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { displayName, registerSchema } from "../validation/auth.js";

/*
  Source assertions for 076_data_api_least_privilege_and_signup_names.sql. The
  migration cannot be run from a test, so these pin what it says: which
  policies go, that no admin-rank clause comes back, which grants are removed
  (and which must stay), and that the sign-up name limits match the form's.
*/

const raw = readFileSync(
  new URL("../../../supabase/migrations/076_data_api_least_privilege_and_signup_names.sql", import.meta.url),
  "utf8",
);
// Statements only: the header explains is_admin() in prose and must not count.
const sql = raw.replace(/--[^\n]*/g, "");
const flat = sql.replace(/\s+/g, " ");
const statements = flat.split(";").map((statement) => statement.trim());

const statement = (start: string) => {
  const found = statements.filter((candidate) => candidate.startsWith(start));
  assert.equal(found.length, 1, `expected exactly one statement starting "${start}"`);
  return found[0];
};

test("076 is one transaction", () => {
  assert.equal(statements[0], "begin");
  // Scoped to this transaction, and set before any statement that takes a table lock.
  assert.equal(statements[1], "set local lock_timeout = '5s'");
  assert.equal(statements.filter((candidate) => candidate.startsWith("set ")).length, 1);
  assert.equal(statements.at(-2), "commit");
  assert.equal(statements.at(-1), "");
});

test("076 drops every admin-rank manage policy on the public content tables", () => {
  const dropped: Array<[policy: string, table: string]> = [
    ["admin manage news", "news_articles"],
    ["admin manage news_articles", "news_articles"],
    ["admin manage gallery", "gallery_images"],
    ["admin manage gallery_images", "gallery_images"],
    ["admin manage events", "events"],
    ["admin manage modes", "game_modes"],
    ["admin manage game_modes", "game_modes"],
    ["admin manage rules", "rules"],
    ["admin manage rule categories", "rule_categories"],
    ["admin manage rule_categories", "rule_categories"],
    ["admin manage products", "products"],
    ["admin manage vote sites", "vote_sites"],
    ["admin manage vote_sites", "vote_sites"],
  ];
  for (const [policy, table] of dropped) {
    assert.ok(statements.includes(`drop policy if exists "${policy}" on public.${table}`), `${policy} is dropped`);
  }
  assert.doesNotMatch(flat, /create policy "admin manage/);
});

test("076 recreates the public read policies with today's rule and no admin clause", () => {
  const recreated: Array<[policy: string, table: string, rule: string]> = [
    ["published news public read", "news_articles", "(status = 'published' and (published_at is null or published_at <= now()))"],
    ["gallery public read", "gallery_images", "(status = 'published')"],
    ["events public read", "events", "(status <> 'draft')"],
    ["public modes read", "game_modes", "(enabled)"],
    ["rules public read", "rules", "(enabled)"],
    ["products public read", "products", "(enabled)"],
    ["vote sites public read", "vote_sites", "(enabled)"],
  ];
  for (const [policy, table, rule] of recreated) {
    const drop = statements.indexOf(`drop policy if exists "${policy}" on public.${table}`);
    const create = statements.indexOf(`create policy "${policy}" on public.${table} for select using ${rule}`);
    assert.ok(drop >= 0 && create === drop + 1, `${policy} is dropped then recreated as select-only with its public rule`);
  }
  // Nothing in the migration grants by rank: no is_admin()/is_staff() anywhere in a statement.
  assert.doesNotMatch(sql, /is_admin|is_staff|current_user_role/);
  // Only the two-step gate is non-select; every other policy created here is a public read.
  const created = statements.filter((candidate) => candidate.startsWith("create policy"));
  assert.equal(created.length, recreated.length + 1);
});

test("076 matches the visibility rules the earlier migrations set", () => {
  // If 008/018 are ever read differently, this is where the mismatch shows.
  const read = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8").replace(/\s+/g, " ");
  const m008 = read("008_restore_rls_policies.sql");
  const m018 = read("018_security_policy_hardening.sql");
  assert.ok(m018.includes("(status = 'published' and (published_at is null or published_at <= now())) or public.is_admin()"));
  assert.ok(m018.includes("for select using (status = 'published' or public.is_admin())"));
  assert.ok(m008.includes(`on public.events for select using (status <> 'draft' or public.is_admin())`));
  for (const table of ["game_modes", "rules", "products", "vote_sites"]) {
    assert.ok(m008.includes(`on public.${table} for select using (enabled or public.is_admin())`), table);
  }
});

test("076 revokes the unused browser-role write grants and nothing the app reads with", () => {
  const writes = statement("revoke insert, update, delete on");
  assert.equal(
    writes,
    "revoke insert, update, delete on public.orders, public.order_items, public.minecraft_accounts, public.vote_history, " +
      "public.gallery_likes, public.creator_codes, public.creator_code_products, public.order_invoices, public.invoice_items " +
      "from anon, authenticated",
  );
  assert.ok(statements.includes("revoke insert on public.notifications from anon, authenticated"));

  // Kept on purpose: own-row reads of minecraft_accounts, and delete plus the read_at update on notifications (036, 075).
  const revokes = statements.filter((candidate) => candidate.startsWith("revoke"));
  assert.equal(revokes.length, 3);
  for (const revoke of revokes) {
    assert.doesNotMatch(revoke, /truncate|references|trigger|\ball\b/);
    if (revoke.includes("notifications")) assert.doesNotMatch(revoke, /update|delete|select/);
    if (revoke.includes("select")) assert.equal(revoke, "revoke select on public.orders from anon, authenticated");
  }
});

test("076 leaves the staff-side order columns out of the member's select grant", () => {
  // anon is named too: left out, it would keep a table-wide SELECT that only RLS stood behind.
  const revoke = statements.indexOf("revoke select on public.orders from anon, authenticated");
  const grant = statement("grant select (");
  assert.ok(revoke >= 0 && statements.indexOf(grant) === revoke + 1, "the table grant goes before the column list is granted");
  const columns = grant.slice(grant.indexOf("(") + 1, grant.indexOf(")")).split(",").map((column) => column.trim());
  // The column list is for members only; a signed-out visitor gets nothing back.
  assert.match(grant, /\) on public\.orders to authenticated$/);
  assert.doesNotMatch(grant, /anon/);

  // Every orders column in the Drizzle schema is either granted or one of the three withheld.
  const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
  const table = schema.slice(schema.indexOf('export const orders = pgTable("orders"'));
  const body = table.slice(0, table.indexOf("}, (t) =>"));
  const all = [...body.matchAll(/^\s+\w+: \w+\("(\w+)"/gm)].map((match) => match[1]);
  const withheld = ["handled_by", "ticket_channel_id", "creator_code_id"];
  assert.ok(all.length >= 17, "orders columns were read from the schema");
  assert.deepEqual([...columns].sort(), all.filter((column) => !withheld.includes(column)).sort());
  // The order_items owner policy (070) looks these two up as the member.
  assert.ok(columns.includes("id") && columns.includes("user_id"));
  assert.equal(statements.filter((candidate) => candidate.startsWith("grant")).length, 1);
});

test("076 gives mfa_recovery_codes the same two-step gate 072 gives every other table", () => {
  const drop = statements.indexOf('drop policy if exists "require two-step when enabled" on public.mfa_recovery_codes');
  const create = statements.indexOf(
    'create policy "require two-step when enabled" on public.mfa_recovery_codes as restrictive for all to authenticated ' +
      "using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))",
  );
  assert.ok(drop >= 0 && create === drop + 1);

  // Same shape as the statement 072's loop builds, with the table name filled in.
  const loop = readFileSync(new URL("../../../supabase/migrations/072_two_factor_login_gate.sql", import.meta.url), "utf8");
  assert.ok(loop.includes(`'create policy "require two-step when enabled" on public.%I as restrictive for all to authenticated '`));
  assert.ok(loop.includes(`|| 'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))'`));
});

test("076 caps sign-up usernames at the form's maximum and keeps the helpers' settings", () => {
  const sanitize = statement("create or replace function public.sanitize_username(candidate text)");
  assert.equal(
    sanitize,
    "create or replace function public.sanitize_username(candidate text) returns text language sql immutable set search_path = public as $$ " +
      "select left(regexp_replace(coalesce(candidate, ''), '[^A-Za-z0-9_]', '', 'g'), 16)",
  );
  // The form's own limit, read from the schema rather than restated.
  const username = "a".repeat(16);
  const form = { displayName: "Example Player", email: "player@example.com", password: "Example-pass1", confirm: "Example-pass1", terms: "on" };
  assert.equal(registerSchema.safeParse({ ...form, username }).success, true);
  assert.equal(registerSchema.safeParse({ ...form, username: `${username}a` }).success, false);

  const display = statement("create or replace function public.derive_display_name(meta jsonb, fallback_username text)");
  // 044 pinned search_path; `create or replace` would silently reset it if it were not restated.
  assert.match(display, /^create or replace function public\.derive_display_name\(meta jsonb, fallback_username text\) returns text language sql immutable set search_path = public as \$\$/);
  assert.doesNotMatch(sql, /security definer/);
  // Same order of sources and the same 64-character cap as 031, each one cleaned, then
  // trimmed, then dropped if it is shorter than the form's minimum of 2 characters.
  for (const key of ["display_name", "full_name", "name"]) {
    assert.ok(
      display.includes(
        `substring(regexp_replace(regexp_replace(meta->>'${key}', strip.chars, '', 'g'), strip.edges, '', 'g') from '^.{2,}$'),`,
      ),
      key,
    );
  }
  // SQL trim() removes only U+0020; it must not come back as the way names are trimmed.
  assert.doesNotMatch(display, /\btrim\(/);
  assert.match(display, /\) as strip\(chars, edges\)$/);
  assert.equal(displayName.safeParse("ab").success, true);
  assert.equal(displayName.safeParse("a").success, false);
  assert.ok(display.indexOf("meta->>'display_name'") < display.indexOf("meta->>'full_name'"));
  assert.ok(display.indexOf("meta->>'full_name'") < display.indexOf("meta->>'name'"));
  assert.match(display, /fallback_username \), 64\) from \(values \(/);
  assert.equal(displayName.safeParse("a".repeat(64)).success, true);
  assert.equal(displayName.safeParse("a".repeat(65)).success, false);

  // Untouched: the trigger itself, the uniqueness fallback, and every function grant.
  assert.doesNotMatch(sql, /handle_new_user|unique_username|derive_username/);
  assert.doesNotMatch(sql, /on function/);
});

test("076 strips from display names only characters the form refuses, including every override and zero-width one", () => {
  const pattern = /'(\[\\u0001-[^']+\])'::text/.exec(sql)?.[1];
  assert.ok(pattern, "the character list is a single bracket expression");
  // The list must be written as escapes. Pasted literally, these characters are
  // invisible in review and an editor or formatter can drop them unnoticed.
  assert.doesNotMatch(raw, /[^\n\x20-\x7e]/, "the migration is plain ASCII");
  // Postgres spells code points \uXXXX and \UXXXXXXXX; nothing else may appear inside the brackets.
  assert.match(pattern, /^\[(?:(?:\\u[0-9A-F]{4}|\\U[0-9A-F]{8})-?)+\]$/);
  const stripped = new RegExp(pattern.replace(/\\U([0-9A-F]{8})/g, "\\u{$1}").replace(/\\u([0-9A-F]{4})/g, "\\u{$1}"), "u");

  let count = 0;
  for (let code = 1; code <= 0x10ffff; code += 1) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const char = String.fromCodePoint(code);
    if (!stripped.test(char)) continue;
    count += 1;
    // Padded so the form's trim() cannot remove the character before its own check sees it.
    assert.equal(
      displayName.safeParse(`ab${char}cd`).success,
      false,
      `U+${code.toString(16).toUpperCase()} is stripped by the database but accepted by the form`,
    );
  }
  assert.ok(count > 200, "the list was parsed");

  const mustStrip: Array<[name: string, from: number, to?: number]> = [
    ["C0 controls", 0x01, 0x1f],
    ["DEL and C1 controls", 0x7f, 0x9f],
    ["soft hyphen", 0xad],
    ["Arabic letter mark", 0x61c],
    ["Mongolian vowel separator", 0x180e],
    ["zero-width space, joiners and LRM/RLM", 0x200b, 0x200f],
    ["line and paragraph separators", 0x2028, 0x2029],
    ["embeddings and overrides (LRE, RLE, PDF, LRO, RLO)", 0x202a, 0x202e],
    ["word joiner and invisible operators", 0x2060, 0x2064],
    ["isolates (LRI, RLI, FSI, PDI) and deprecated format characters", 0x2066, 0x206f],
    ["byte order mark", 0xfeff],
    ["interlinear annotation", 0xfff9, 0xfffb],
    ["tag characters", 0xe0020, 0xe007f],
  ];
  for (const [name, from, to = from] of mustStrip) {
    for (let code = from; code <= to; code += 1) {
      assert.ok(stripped.test(String.fromCodePoint(code)), `${name}: U+${code.toString(16).toUpperCase()}`);
    }
  }
  // Ordinary names survive, in any script.
  for (const kept of ["Example Player", "Steve_42", "Élodie", "Алексей", "山田 太郎", "علي"]) {
    assert.equal([...kept].some((char) => stripped.test(char)), false, kept);
  }
});

/** The two patterns from the migration, turned into the JavaScript spelling of the same expressions. */
function namePatterns() {
  const toJs = (pattern: string) => pattern.replace(/\\U([0-9A-F]{8})/g, "\\u{$1}").replace(/\\u([0-9A-F]{4})/g, "\\u{$1}");
  const chars = /'(\[\\u0001-[^']+\])'::text/.exec(sql)?.[1];
  const edges = /'(\^\[[^']+\]\+\$)'::text/.exec(sql)?.[1];
  assert.ok(chars && edges, "both patterns were found");
  return { chars: new RegExp(toJs(chars), "gu"), edges: new RegExp(toJs(edges), "gu"), edgesSource: edges };
}

/** derive_display_name as the migration writes it, for values a test can feed it. */
function deriveDisplayName(meta: Record<string, string | undefined>, fallback: string): string {
  const { chars, edges } = namePatterns();
  const clean = (value: string | undefined) => {
    if (value === undefined) return null;
    const trimmed = value.replace(chars, "").replace(edges, "");
    return [...trimmed].length >= 2 ? trimmed : null;
  };
  return [...(clean(meta.display_name) ?? clean(meta.full_name) ?? clean(meta.name) ?? fallback)].slice(0, 64).join("");
}

test("076 trims every space the form trims, not only U+0020", () => {
  const { chars, edges, edgesSource } = namePatterns();
  // One class, used at both ends, written as escapes only.
  const classes = [...edgesSource.matchAll(/\[[^\]]+\]/g)].map((match) => match[0]);
  assert.equal(classes.length, 2);
  assert.equal(classes[0], classes[1]);
  assert.equal(edgesSource, `^${classes[0]}+|${classes[0]}+$`);
  assert.match(classes[0], /^\[(?:\\u[0-9A-F]{4}-?)+\]$/);

  const space = new RegExp(classes[0].replace(/\\u([0-9A-F]{4})/g, "\\u{$1}"), "u");
  for (let code = 1; code <= 0x10ffff; code += 1) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const char = String.fromCodePoint(code);
    const label = `U+${code.toString(16).toUpperCase()}`;
    chars.lastIndex = 0;
    // Everything String.prototype.trim() removes is either stripped outright or trimmed here...
    if (char.trim() === "") assert.ok(chars.test(char) || space.test(char), `${label} is trimmed by the form but kept by the database`);
    // ...and nothing else is treated as a space.
    if (space.test(char)) assert.equal(char.trim(), "", `${label} is trimmed by the database but not by the form`);
  }
  for (const code of [0x20, 0xa0, 0x1680, 0x2000, 0x200a, 0x202f, 0x205f, 0x3000]) {
    assert.equal(String.fromCodePoint(code).replace(edges, ""), "", `U+${code.toString(16).toUpperCase()}`);
  }
});

test("076 never stores an invisible or one-character display name", () => {
  const fallback = "Steve_42";
  // A lone no-break or ideographic space used to be stored as the name.
  for (const blank of ["\u00a0", "\u3000", " \u2003\u202f ", "\u200b\u00a0\u200b", ""]) {
    assert.equal(deriveDisplayName({ display_name: blank }, fallback), fallback, JSON.stringify(blank));
  }
  // Shorter than the form's minimum falls through to the next source, in order.
  assert.equal(deriveDisplayName({ display_name: "\u3000A\u3000", full_name: "Alex Builder" }, fallback), "Alex Builder");
  assert.equal(deriveDisplayName({ display_name: "\u00a0", full_name: "B", name: "Example Player" }, fallback), "Example Player");
  assert.equal(deriveDisplayName({}, fallback), fallback);
  // Spaces inside a name are kept; only the ends are trimmed.
  assert.equal(deriveDisplayName({ display_name: "\u00a0Example\u3000Player\u2009" }, fallback), "Example\u3000Player");
  assert.equal(deriveDisplayName({ display_name: "  Al  " }, fallback), "Al");
  // Whatever comes out is a name the form would have accepted.
  for (const sent of ["\u00a0Example Player\u00a0", "\u202eAlex\u200b Builder", "\u3000Example Player"]) {
    const stored = deriveDisplayName({ display_name: sent }, fallback);
    assert.equal(displayName.safeParse(stored).success, true, JSON.stringify(sent));
    assert.equal(displayName.parse(stored), stored);
  }
});

