import assert from "node:assert/strict";
import test from "node:test";
import { BANDS, BUILTIN_ROLES, GATE_ROLE_KEYS, setRoleCatalog, type RoleDef } from "@/lib/auth/role-catalog-core";
import { hasAtLeast } from "@/lib/auth/roles";
import { bandOrder, deleteDestination, deriveRoleKey, editableFields, isValidDeleteDestination, placeAbove, positionsFor, validateRoleInput } from "@/lib/roles-rules";

const valid = { key: "builder", label: "Builder", color: "#22c55e", icon: "Hammer", description: "", kind: "staff", showOnTeam: true };

test("role input is validated strictly", () => {
  assert.ok(validateRoleInput(valid).ok);
  for (const patch of [{ key: "Builder" }, { key: "it" }, { key: "web_dev" }, { label: "" }, { label: "x".repeat(33) }, { color: "red" },
    { icon: "Skull" }, { kind: "base" }, { description: "x".repeat(161) }]) {
    assert.equal(validateRoleInput({ ...valid, ...patch }).ok, false, JSON.stringify(patch));
  }
});

test("locked roles can be renamed and recoloured only", () => {
  const owner = BUILTIN_ROLES.find((r) => r.key === "owner")!;
  const helper = BUILTIN_ROLES.find((r) => r.key === "helper")!;
  assert.deepEqual(editableFields(owner), { label: true, color: true, icon: true, description: true, showOnTeam: true, position: false, delete: false });
  assert.equal(editableFields(helper).delete, false, "helper is gate-referenced");
  assert.equal(editableFields(BUILTIN_ROLES.find((r) => r.key === "member")!).showOnTeam, false);
});

test("gate-referenced built-ins can be edited and moved but never deleted", () => {
  assert.deepEqual([...GATE_ROLE_KEYS].sort(), ["administrator", "helper", "moderator", "senior_moderator"]);
  for (const key of ["helper", "moderator", "senior_moderator", "administrator"]) {
    const fields = editableFields(BUILTIN_ROLES.find((r) => r.key === key)!);
    assert.equal(fields.delete, false, key);
    assert.equal(fields.position, true, `${key} stays movable`);
    assert.equal(fields.label && fields.color, true, `${key} stays renamable/recolourable`);
  }
  for (const key of ["vip", "sponsor"]) assert.equal(editableFields(BUILTIN_ROLES.find((r) => r.key === key)!).delete, true, key);
  const custom: RoleDef = { key: "builder", label: "Builder", color: "#22c55e", icon: null, description: "", kind: "staff", position: 450, locked: false, showOnTeam: true };
  assert.equal(editableFields(custom).delete, true);
  assert.equal(editableFields({ ...custom, kind: "public", position: 250 }).delete, true);
});

test("deleting every deletable staff role and re-spreading never lifts Helper to Moderator's gate", () => {
  const customs: RoleDef[] = ["builder", "artist", "mentor"].map((key, i) => ({
    key, label: key, color: "#22c55e", icon: null, description: "", kind: "staff", position: 410 + i * 20, locked: false, showOnTeam: true,
  }));
  let catalog: RoleDef[] = [...BUILTIN_ROLES, ...customs];
  try {
    assert.ok(setRoleCatalog(catalog));
    for (const role of [...catalog]) {
      if (role.kind !== "staff" || !editableFields(role).delete) continue;
      catalog = catalog.filter((r) => r.key !== role.key);
      const positions = positionsFor(bandOrder(catalog, "staff"), "staff");
      catalog = catalog.map((r) => (positions.has(r.key) ? { ...r, position: positions.get(r.key)! } : r));
      assert.ok(setRoleCatalog(catalog), `catalogue valid after deleting ${role.key}`);
      assert.equal(hasAtLeast("helper", "moderator"), false, `after deleting ${role.key}`);
      assert.equal(hasAtLeast("moderator", "senior_moderator"), false, `after deleting ${role.key}`);
      assert.equal(hasAtLeast("senior_moderator", "administrator"), false, `after deleting ${role.key}`);
    }
    assert.deepEqual(bandOrder(catalog, "staff"), ["helper", "moderator", "senior_moderator", "administrator"], "only the custom roles went");
  } finally {
    setRoleCatalog(BUILTIN_ROLES);
  }
});

test("placement stays inside the band and above the chosen role", () => {
  const order = bandOrder(BUILTIN_ROLES, "staff");
  assert.deepEqual(order, ["helper", "moderator", "senior_moderator", "administrator"]);
  const next = placeAbove(order, "builder", "helper");
  assert.deepEqual(next, ["helper", "builder", "moderator", "senior_moderator", "administrator"]);
  assert.deepEqual(placeAbove(order, "builder", null)[0], "builder");
  const positions = positionsFor(next, "staff");
  assert.ok([...positions.values()].every((p) => p >= BANDS.staff.min && p <= BANDS.staff.max));
  assert.ok(positions.get("builder")! > positions.get("helper")!);
});

test("deleting moves holders to the next role down, or Member", () => {
  assert.equal(deleteDestination(BUILTIN_ROLES, "moderator"), "helper");
  assert.equal(deleteDestination(BUILTIN_ROLES, "helper"), "member");
  assert.equal(deleteDestination(BUILTIN_ROLES, "vip"), "member");
});

test("delete destinations may only move members strictly downward, never to guest or a role the actor cannot grant", () => {
  // Upward: moving "helper"'s members up to "administrator" is refused.
  assert.equal(isValidDeleteDestination(BUILTIN_ROLES, "helper", "administrator", "owner"), false);
  // Guest is never a valid destination.
  assert.equal(isValidDeleteDestination(BUILTIN_ROLES, "moderator", "guest", "owner"), false);
  // Same role as the one being deleted (position tie) is refused.
  assert.equal(isValidDeleteDestination(BUILTIN_ROLES, "moderator", "moderator", "owner"), false);
  // Locked top role (owner cannot grant web_dev (Web Dev) to anyone).
  assert.equal(isValidDeleteDestination(BUILTIN_ROLES, "administrator", "web_dev", "owner"), false);
  // A valid next-role-down move.
  assert.equal(isValidDeleteDestination(BUILTIN_ROLES, "moderator", "helper", "owner"), true);
});

test("role IDs are derived from the name", () => {
  assert.equal(deriveRoleKey("Builder"), "builder");
  assert.equal(deriveRoleKey("  Senior  Builder "), "senior_builder");
  assert.equal(deriveRoleKey("Map-Maker #1!"), "mapmaker_1");
  assert.equal(deriveRoleKey("3D Artist"), "d_artist");
  assert.equal(deriveRoleKey("_Évent Team"), "vent_team");
  assert.equal(deriveRoleKey("x".repeat(40)).length, 32);
  assert.equal(deriveRoleKey("!!!"), "");
  assert.ok(validateRoleInput({ ...valid, key: deriveRoleKey("Event Host") }).ok);
});
