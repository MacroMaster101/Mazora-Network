import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach } from "node:test";
import {
  BANDS,
  BUILTIN_POSITION,
  BUILTIN_ROLES,
  isValidHexColor,
  isValidRoleKey,
  normalizeRoleKey,
  positionOf,
  roleCatalog,
  roleDef,
  ROLE_ICONS,
  setRoleCatalog,
  spreadPositions,
  thresholdOf,
  type RoleDef,
} from "@/lib/auth/role-catalog-core";
import { canGrantRank, canManageRank, hasAtLeast, isRoleKey, isStaff, roleKeys, roleLabel, staffRoleKeys } from "@/lib/auth/roles";

beforeEach(() => setRoleCatalog(BUILTIN_ROLES));

const builder: RoleDef = {
  key: "builder", label: "Builder", color: "#22c55e", icon: "Hammer", description: "",
  kind: "staff", position: 450, locked: false, showOnTeam: true,
};

test("built-ins are seeded in today's order, IT labelled Web Dev", () => {
  assert.deepEqual(
    [...BUILTIN_ROLES].sort((a, b) => a.position - b.position).map((r) => r.key),
    ["guest", "member", "sponsor", "vip", "helper", "moderator", "senior_moderator", "administrator", "owner", "web_dev"],
  );
  assert.equal(roleDef("web_dev")?.label, "Web Dev");
  assert.deepEqual(BUILTIN_ROLES.filter((r) => r.locked).map((r) => r.key).sort(), ["member", "owner", "web_dev"]);
});

test("the catalogue is listed highest first", () => {
  assert.equal(roleCatalog()[0].key, "web_dev");
  assert.equal(roleCatalog().at(-1)?.key, "guest");
});

test("a custom role slots into the ladder by position", () => {
  assert.ok(setRoleCatalog([...BUILTIN_ROLES, builder]));
  assert.ok(positionOf("builder") > positionOf("helper"));
  assert.ok(positionOf("builder") < positionOf("moderator"));
});

test("an unknown key ranks as member, never staff", () => {
  assert.equal(positionOf("ghost"), BUILTIN_POSITION.member);
  assert.equal(positionOf(null), BUILTIN_POSITION.member);
});

test("a gate on a deleted built-in keeps its seeded position", () => {
  setRoleCatalog(BUILTIN_ROLES.filter((r) => r.key !== "moderator"));
  assert.equal(thresholdOf("moderator"), BUILTIN_POSITION.moderator);
  assert.equal(thresholdOf("nonsense"), Number.POSITIVE_INFINITY);
});

test("a catalogue missing a locked built-in is rejected", () => {
  assert.equal(setRoleCatalog(BUILTIN_ROLES.filter((r) => r.key !== "owner")), false);
  assert.ok(roleDef("owner"), "built-ins kept");
});

test("a catalogue with a role outside its band is rejected", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES, { ...builder, position: 200 }]), false);
  assert.equal(setRoleCatalog([...BUILTIN_ROLES, { ...builder, kind: "public", position: 450 }]), false);
});

test("role keys and colours are validated strictly", () => {
  assert.ok(isValidRoleKey("web_dev"));
  for (const bad of ["", "A", "1abc", "web-dev", "x".repeat(40), 5, null]) assert.equal(isValidRoleKey(bad), false);
  assert.ok(isValidHexColor("#e11d48"));
  for (const bad of ["red", "#fff", "#E11D48", "url(x)", "#zzzzzz", "e11d48", null]) assert.equal(isValidHexColor(bad), false);
});

test("spreadPositions gives distinct ascending positions inside the band", () => {
  const positions = spreadPositions(5, BANDS.staff);
  assert.equal(positions.length, 5);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal(new Set(positions).size, 5);
  assert.ok(positions.every((p) => p >= BANDS.staff.min && p <= BANDS.staff.max));
});

test("locked built-ins are pinned: member cannot be moved to staff", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "member" ? { ...r, position: 450, kind: "staff" as const } : r)]), false);
  assert.ok(roleDef("member"), "built-ins kept");
  assert.equal(positionOf("member"), BUILTIN_POSITION.member);
});

test("locked built-ins are pinned: it cannot change kind", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "web_dev" ? { ...r, kind: "public" as const } : r)]), false);
  assert.ok(roleDef("web_dev"), "built-ins kept");
});

test("locked built-ins are pinned: owner cannot be unlocked", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "owner" ? { ...r, locked: false } : r)]), false);
  assert.ok(roleDef("owner"), "built-ins kept");
});

test("a custom role cannot have kind base", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES, { ...builder, kind: "base" as const }]), false);
  assert.equal(roleDef("builder"), undefined, "custom role rejected");
});

test("member may be renamed and recoloured", () => {
  assert.ok(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "member" ? { ...r, label: "Player", color: "#6366f1" } : r)]));
  assert.equal(roleDef("member")?.label, "Player");
  assert.equal(roleDef("member")?.color, "#6366f1");
  assert.equal(positionOf("member"), BUILTIN_POSITION.member);
});

test("guest with kind base at position 450 is rejected", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "guest" ? { ...r, position: 450 } : r)]), false);
  assert.ok(roleDef("guest"), "built-ins kept");
  assert.equal(positionOf("guest"), BUILTIN_POSITION.guest);
});

test("guest with kind staff at position 450 is rejected", () => {
  assert.equal(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "guest" ? { ...r, kind: "staff" as const, position: 450 } : r)]), false);
  assert.ok(roleDef("guest"), "built-ins kept");
  assert.equal(positionOf("guest"), BUILTIN_POSITION.guest);
});

test("guest renamed to Visitor with kind base at position 0 is accepted", () => {
  assert.ok(setRoleCatalog([...BUILTIN_ROLES.map((r) => r.key === "guest" ? { ...r, label: "Visitor" } : r)]));
  assert.equal(roleDef("guest")?.label, "Visitor");
  assert.equal(roleDef("guest")?.kind, "base");
  assert.equal(positionOf("guest"), BUILTIN_POSITION.guest);
});

test("helpers follow the catalogue, including custom roles", () => {
  setRoleCatalog([...BUILTIN_ROLES, builder]);
  assert.ok(hasAtLeast("builder", "helper"));
  assert.ok(!hasAtLeast("builder", "moderator"));
  assert.ok(isStaff("builder"));
  assert.ok(!isStaff("vip"));
  assert.equal(roleLabel("builder"), "Builder");
  assert.equal(roleLabel("web_dev"), "Web Dev");
  assert.ok(isRoleKey("builder"));
  assert.ok(!isRoleKey("ghost"));
  assert.deepEqual(staffRoleKeys(), ["helper", "builder", "moderator", "senior_moderator", "administrator", "owner", "web_dev"]);
  assert.equal(roleKeys()[0], "guest");
});

test("rank rules are unchanged: act strictly below yourself, the top rung on peers", () => {
  setRoleCatalog([...BUILTIN_ROLES, builder]);
  assert.ok(canManageRank("moderator", "builder"));
  assert.ok(!canManageRank("builder", "moderator"));
  assert.ok(!canGrantRank("builder", "builder"));
  assert.ok(canGrantRank("web_dev", "web_dev"));
  assert.ok(!hasAtLeast("ghost", "helper"), "unknown key is not staff");
});

test("an unknown actor key ranks as member and never gets unlimited reach", () => {
  assert.equal(canManageRank("ghost", "member"), false);
  assert.equal(canGrantRank("ghost", "member"), false);
  assert.equal(canManageRank("ghost", "helper"), false);
  assert.equal(canGrantRank("ghost", "owner"), false);
  assert.equal(canManageRank("ghost", "guest"), true, "still acts strictly below member, like a member");
});

test("migration 054 seeds exactly the built-in catalogue (Web Dev under its pre-055 key)", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/054_roles.sql", import.meta.url), "utf8");
  for (const role of BUILTIN_ROLES) {
    // 054 predates the rename and seeds Web Dev under the legacy key; 055 renames it.
    const seededKey = role.key === "web_dev" ? "it" : role.key;
    assert.match(sql, new RegExp(`\\('${seededKey}', '${role.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}', '${role.color}'`), role.key);
  }
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke insert, update, delete on public\.roles from anon, authenticated/);
});

test("migration 054 converts an enum profiles.role to text before creating the catalogue", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/054_roles.sql", import.meta.url), "utf8");
  const guard = sql.search(/do \$\$/);
  assert.ok(guard > sql.indexOf("begin;"), "guard runs inside the transaction");
  assert.ok(guard < sql.indexOf("create table if not exists public.roles"), "guard runs first");
  assert.match(sql, /column_name = 'role' and udt_name = 'user_role'/);
  assert.match(sql, /alter table public\.profiles alter column role drop default;/);
  assert.match(sql, /alter table public\.profiles alter column role type text using role::text;/);
  assert.match(sql, /alter table public\.profiles alter column role set default 'member';/);
});

test("the role catalogue loader dedupes repeated failure logs", () => {
  // roles.ts is "server-only" and cannot be imported from this test, so the
  // guard is asserted at the source level instead.
  const src = readFileSync(new URL("../data/roles.ts", import.meta.url), "utf8");
  assert.match(src, /lastLoggedFailure: string \| null;/);
  assert.match(
    src,
    /if \(message !== state\.lastLoggedFailure\) \{\s*(?:console\.error|reportDatabaseReadFailure)\("Role catalogue could not be loaded; keeping the last good catalogue \(built-ins if none\)", error\);\s*state\.lastLoggedFailure = message;\s*\}/,
  );
  assert.match(src, /state\.lastLoggedFailure = null;/);
});

test("normalizeRoleKey folds the legacy top-role key into web_dev and passes everything else through", () => {
  assert.equal(normalizeRoleKey("it"), "web_dev");
  for (const key of ["web_dev", "owner", "member", "guest", "builder", "It", "IT", ""]) {
    assert.equal(normalizeRoleKey(key), key);
  }
  assert.equal(normalizeRoleKey(undefined), undefined);
  assert.equal(normalizeRoleKey(null), null);
  assert.equal(normalizeRoleKey(42), 42);
  // The legacy key itself is not a catalogue role — only its normalised form is.
  assert.equal(isRoleKey("it"), false);
  assert.equal(isRoleKey(normalizeRoleKey("it")), true);
  assert.equal(hasAtLeast(normalizeRoleKey("it") as string, "owner"), true);
});

test("migration 056 gives the public ranks and Member their built-in icons without overwriting a chosen one", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/056_public_role_icons.sql", import.meta.url), "utf8");
  for (const key of ["vip", "sponsor", "member"]) {
    const icon = BUILTIN_ROLES.find((role) => role.key === key)?.icon;
    assert.ok(icon && (ROLE_ICONS as readonly string[]).includes(icon), key);
    assert.ok(sql.includes(`set icon = '${icon}', updated_at = now() where key = '${key}' and icon is null;`), key);
  }
});

test("the catalogue registry is shared across module copies via globalThis", () => {
  setRoleCatalog([...BUILTIN_ROLES, { key: "builder", label: "Builder", color: "#22c55e", icon: null, description: "", kind: "staff", position: 450, locked: false, showOnTeam: true }]);
  // A second copy of role-catalog-core (as Next creates for server actions) reads the same object.
  const shared = (globalThis as Record<symbol, { byKey: Map<string, unknown> }>)[Symbol.for("mazora.roleCatalog.registry")];
  assert.ok(shared?.byKey.has("builder"));
  setRoleCatalog(BUILTIN_ROLES);
  assert.equal(shared.byKey.has("builder"), false);
});
