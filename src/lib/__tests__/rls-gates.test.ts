import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

/*
  072 (two-step gate) and 074 (suspended-account gate) each add a RESTRICTIVE
  policy to every table that had RLS on when they ran. A table created later
  does not get them automatically, so a migration that turns RLS on for a new
  table must add both itself — this catches one that forgets.

  Creating a table counts as turning RLS on. The live database has an event
  trigger that enables RLS on every new public table, so a migration that only
  says `create table public.x (...)` ends up with RLS and neither gate.
*/

const dir = new URL("../../../supabase/migrations/", import.meta.url);
const migrations = readdirSync(dir)
  .filter((name) => /^\d{3}_.*\.sql$/.test(name))
  .sort();
const number = (name: string) => Number.parseInt(name.slice(0, 3), 10);

test("the gate migrations are where this test expects them", () => {
  assert.ok(migrations.includes("072_two_factor_login_gate.sql"));
  assert.ok(migrations.includes("074_suspended_account_gate.sql"));
});

const GATES = [
  { policy: "require two-step when enabled", check: "mfa_satisfied", source: "072" },
  { policy: "suspended accounts are closed", check: "account_usable", source: "074" },
] as const;

/** Lower-cased SQL with comments removed, so prose mentioning a policy is not mistaken for one. */
function statementsOf(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .toLowerCase();
}

/**
 * The gates a migration owes and does not add: one line per table it creates
 * in `public` or turns RLS on for that lacks a restrictive gate policy ON THAT
 * TABLE.
 *
 * A gate counts when the file has either
 *   - `create policy "<name>" on public.<table> as restrictive … <check>()`, or
 *   - the 072/074 loop (`… on public.%I as restrictive …` over every table with
 *     relrowsecurity) placed AFTER the statement that enables RLS (or creates
 *     the table), since the loop only reaches tables that already have it on.
 */
function missingGates(rawSql: string): string[] {
  const sql = statementsOf(rawSql);
  const owing = [
    ...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([\w%]+)"?\s+enable\s+row\s+level\s+security/g),
    // The event trigger turns RLS on for these without the migration saying so.
    ...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.\s*"?([\w%]+)"?/g),
  ].map((match) => ({ table: match[1], at: match.index }));
  // One entry per table, at its LAST such statement: a loop has to come after all of them.
  const latest = new Map<string, number>();
  for (const { table, at } of owing) latest.set(table, Math.max(at, latest.get(table) ?? -1));
  const enabled = [...latest].map(([table, at]) => ({ table, at }));

  const missing: string[] = [];
  for (const { table, at } of enabled) {
    for (const gate of GATES) {
      const loop = new RegExp(
        `create\\s+policy\\s+"${gate.policy}"\\s+on\\s+public\\.%i\\s+as\\s+restrictive\\b[^;]*?${gate.check}\\(\\)`,
        "g",
      );
      const coveredByLoop = sql.includes("relrowsecurity") && [...sql.matchAll(loop)].some((match) => match.index > at);
      // `%i` is a table name filled in at run time (execute format): only the loop can cover it.
      const direct = new RegExp(
        `create\\s+policy\\s+"${gate.policy}"\\s+on\\s+(?:public\\.)?"?${table}"?\\s+as\\s+restrictive\\b[^;]*?${gate.check}\\(\\)`,
      );
      const coveredDirectly = !table.includes("%") && direct.test(sql);
      if (!coveredByLoop && !coveredDirectly) missing.push(`${table}: "${gate.policy}"`);
    }
  }
  return missing;
}

test("every table created or given RLS after 074 also gets both restrictive gates", () => {
  for (const name of migrations.filter((file) => number(file) > 74)) {
    const missing = missingGates(readFileSync(new URL(name, dir), "utf8"));
    assert.deepEqual(
      missing,
      [],
      `${name}: table created or RLS turned on without a gate on the same table — copy the policies from 072 and 074 (${missing.join("; ")})`,
    );
  }
});

test("the gate check ties each policy to the table that got RLS", () => {
  const gate = (policy: string, check: string, table: string) =>
    `create policy "${policy}" on public.${table} as restrictive for all to authenticated\n` +
    `  using ((select public.${check}())) with check ((select public.${check}()));\n`;
  const both = (table: string) =>
    gate("require two-step when enabled", "mfa_satisfied", table) + gate("suspended accounts are closed", "account_usable", table);
  const enable = (table: string) => `alter table public.${table} enable row level security;\n`;

  // The old loophole: both policy names and the table name appear in the file,
  // but the gates sit on a different table.
  assert.deepEqual(missingGates(both("example_notes") + enable("example_drafts")), [
    'example_drafts: "require two-step when enabled"',
    'example_drafts: "suspended accounts are closed"',
  ]);
  // A table whose name merely starts the same does not count either.
  assert.equal(missingGates(both("example_drafts_archive") + enable("example_drafts")).length, 2);
  // Naming the policy in a comment is not adding it.
  assert.equal(
    missingGates(`-- create policy "require two-step when enabled" on public.example_drafts as restrictive mfa_satisfied()\n` + enable("example_drafts")).length,
    2,
  );
  // One gate is not two, and a permissive policy with the right name is not a gate.
  assert.deepEqual(missingGates(enable("example_drafts") + gate("require two-step when enabled", "mfa_satisfied", "example_drafts")), [
    'example_drafts: "suspended accounts are closed"',
  ]);
  assert.equal(missingGates(enable("example_drafts") + both("example_drafts").replaceAll(" as restrictive", "")).length, 2);

  // Both gates on the same table pass, in either order.
  assert.deepEqual(missingGates(enable("example_drafts") + both("example_drafts")), []);
  assert.deepEqual(missingGates(both("example_drafts") + enable("example_drafts")), []);

  // The loop form passes only when it runs after RLS is on.
  const loop = (policy: string, check: string) =>
    `do $$ declare t record; begin for t in select c.relname from pg_class c where c.relrowsecurity loop\n` +
    `execute format('create policy "${policy}" on public.%I as restrictive for all to authenticated '\n` +
    `  || 'using ((select public.${check}())) with check ((select public.${check}()))', t.relname);\nend loop; end $$;\n`;
  const loops = loop("require two-step when enabled", "mfa_satisfied") + loop("suspended accounts are closed", "account_usable");
  assert.deepEqual(missingGates(enable("example_drafts") + loops), []);
  assert.equal(missingGates(loops + enable("example_drafts")).length, 2);

  // A table that is only created owes both gates too: the database's event
  // trigger turns RLS on for it even though the migration never says so.
  const create = (table: string, guard = "") => `create table ${guard}public.${table} (id uuid primary key);\n`;
  assert.deepEqual(missingGates(create("example_drafts")), [
    'example_drafts: "require two-step when enabled"',
    'example_drafts: "suspended accounts are closed"',
  ]);
  assert.equal(missingGates(create("example_drafts", "if not exists ")).length, 2);
  assert.equal(missingGates("CREATE TABLE IF NOT EXISTS public.example_drafts (id uuid primary key);\n").length, 2);
  assert.deepEqual(missingGates(create("example_drafts") + gate("require two-step when enabled", "mfa_satisfied", "example_drafts")), [
    'example_drafts: "suspended accounts are closed"',
  ]);
  // Gates on a different table do not cover it.
  assert.equal(missingGates(create("example_drafts") + both("example_notes")).length, 2);
  assert.deepEqual(missingGates(create("example_drafts") + both("example_drafts")), []);
  assert.deepEqual(missingGates(create("example_drafts", "if not exists ") + both("example_drafts")), []);
  // Created and enabled in the same file is still one table owing two gates, not four.
  assert.equal(missingGates(create("example_drafts") + enable("example_drafts")).length, 2);
  assert.deepEqual(missingGates(create("example_drafts") + enable("example_drafts") + both("example_drafts")), []);
  // The loop has to run after the table exists.
  assert.deepEqual(missingGates(create("example_drafts") + loops), []);
  assert.equal(missingGates(loops + create("example_drafts")).length, 2);
  assert.equal(missingGates(create("example_drafts") + loops + enable("example_drafts")).length, 2);
  // A table mentioned only in a comment, or created outside public, owes nothing.
  assert.deepEqual(missingGates("-- create table public.example_drafts (id uuid);\n"), []);
  assert.deepEqual(missingGates("create table private.example_drafts (id uuid primary key);\n"), []);

  // The real gate migrations use exactly the shapes this accepts.
  const read = (name: string) => statementsOf(readFileSync(new URL(name, dir), "utf8"));
  assert.match(read("072_two_factor_login_gate.sql"), /create policy "require two-step when enabled" on public\.%i as restrictive\b[^;]*mfa_satisfied\(\)/);
  assert.match(read("074_suspended_account_gate.sql"), /create policy "suspended accounts are closed" on public\.%i as restrictive\b[^;]*account_usable\(\)/);
});

test("deleting an account throttles password guesses and checks the server first", () => {
  const src = readFileSync(new URL("../actions/account.ts", import.meta.url), "utf8");
  const action = src.slice(src.indexOf("export async function deleteAccountAction"));
  const admin = action.indexOf("const admin = getSupabaseAdmin();");
  const throttle = action.indexOf('throttleAuthAction("account-delete"');
  const password = action.indexOf("await passwordMatchesCurrent(");
  const step = action.indexOf("await confirmSecondStep(");
  assert.ok(admin > 0 && admin < password && admin < step, "server checked before any proof is taken");
  assert.ok(throttle > 0 && throttle < password, "throttled before the password is tried");
});

test("no migration after 070 lets the browser write to storage", () => {
  // 060 dropped every avatar write policy and 070 the public listing; all
  // uploads go through the service role, which checks and re-encodes them.
  for (const name of migrations.filter((file) => number(file) > 70)) {
    const sql = readFileSync(new URL(name, dir), "utf8").toLowerCase();
    const storagePolicies = [...sql.matchAll(/create\s+policy[\s\S]*?on\s+storage\.objects[\s\S]*?;/g)].map((match) => match[0]);
    for (const policy of storagePolicies) {
      assert.ok(
        !/for\s+(all|insert|update|delete)\b/.test(policy) && !/\bto\s+(anon|authenticated|public)\b[\s\S]*with\s+check/.test(policy),
        `${name}: a storage.objects policy allows browser writes — uploads must stay server-side`,
      );
    }
  }
});

test("image path fields refuse //host and gallery uploads get unique names", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../actions/news.ts"), /if \(raw\.startsWith\("\/"\)\) return isSitePath\(raw\) \? raw : null;/);
  assert.match(read("../actions/store-admin.ts"), /if \(isSitePath\(raw\) \|\| isOwnStorageUrl\(raw\) \|\| raw === currentUrl\)/);
  const gallery = read("../actions/gallery.ts");
  assert.match(gallery, /`submit-\$\{randomUUID\(\)\}`/);
  assert.doesNotMatch(gallery, /`(submit|admin)-\$\{Date\.now\(\)\}`/);
});
