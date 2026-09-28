import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

/*
  072 (two-step gate) and 074 (suspended-account gate) each add a RESTRICTIVE
  policy to every table that had RLS on when they ran. A table created later
  does not get them automatically, so a migration that turns RLS on for a new
  table must add both itself — this catches one that forgets.
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

test("every table given RLS after 074 also gets both restrictive gates", () => {
  for (const name of migrations.filter((file) => number(file) > 74)) {
    const sql = readFileSync(new URL(name, dir), "utf8").toLowerCase();
    // Tables this migration turns RLS on for, e.g. `alter table public.foo enable row level security`.
    const tables = [...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/g)].map(
      (match) => match[1],
    );
    for (const table of tables) {
      for (const policy of ["require two-step when enabled", "suspended accounts are closed"]) {
        assert.ok(
          sql.includes(`"${policy}"`) && sql.includes(table),
          `${name}: ${table} has RLS but no "${policy}" policy — copy it from ${policy.startsWith("require") ? "072" : "074"}`,
        );
      }
    }
  }
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
