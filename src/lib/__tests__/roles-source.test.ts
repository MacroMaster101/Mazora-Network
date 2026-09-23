import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const actions = readFileSync(new URL("../actions/role-catalog.ts", import.meta.url), "utf8");
const roleActions = readFileSync(new URL("../actions/roles.ts", import.meta.url), "utf8");
const permissions = readFileSync(new URL("../auth/permissions.ts", import.meta.url), "utf8");
const permissionActions = readFileSync(new URL("../actions/permissions.ts", import.meta.url), "utf8");

test("assigning roles needs the Assign roles permission plus rank limits", () => {
  assert.match(permissions, /ROLES_ASSIGN_PERMISSION_KEY = "roles\.assign\.permissions"/);
  const body = roleActions.slice(roleActions.indexOf("export async function changeUserRole"));
  const guard = body.indexOf("canAssignRoles(");
  assert.ok(guard > -1 && guard < body.indexOf("canManageRank("), "permission first, then rank");
  assert.match(body, /canGrantRank\(/);
  assert.match(body, /cannot change your own role/);
});

test("stored permission lists keep custom roles", () => {
  assert.match(permissions, /isRoleKey\(r\)/);
  assert.doesNotMatch(permissions, /ROLES\.includes/);
});

test("every role catalogue action checks Owner/Web Dev on the server first", () => {
  const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(exported.sort(), ["createRoleAction", "deleteRoleAction", "reorderRolesAction", "updateRoleAction"]);
  for (const name of exported) {
    const body = actions.slice(actions.indexOf(`export async function ${name}`));
    const guard = body.indexOf("await requireRoleManager()");
    const firstWrite = body.search(/\.insert\(|\.update\(|\.delete\(/);
    assert.ok(guard > -1 && guard < firstWrite, `${name} guards before writing`);
  }
});

test("mutations refresh the catalogue and are audit-logged", () => {
  assert.match(actions, /await refreshRoleCatalog\(\)/);
  for (const action of ["roles.create", "roles.update", "roles.reorder", "roles.delete"]) assert.match(actions, new RegExp(`"${action.replace(".", "\\.")}"`));
});

test("locked roles cannot be deleted or moved even by a hand-made request", () => {
  assert.match(actions, /editableFields\(role\)\.delete/);
  assert.match(actions, /bandOrder\(/);
});

test("deleteRoleAction validates the destination and checks the auth update error before deleting the role row", () => {
  assert.match(actions, /isValidDeleteDestination\(/);
  const body = actions.slice(actions.indexOf("export async function deleteRoleAction"));
  const errorCheck = body.indexOf("if (error)");
  const roleRowDelete = body.indexOf(".delete(schema.roles)");
  assert.ok(errorCheck > -1 && roleRowDelete > -1, "expects both an error check and a role-row delete");
  assert.ok(errorCheck < roleRowDelete, "the auth update error must be checked before the role row is deleted");
});

test("only Web Dev can change Web Dev-only module grants from the role modal", () => {
  const grants = actions.slice(actions.indexOf("async function setModuleGrants"));
  assert.match(grants.slice(0, grants.search(/\r?\n\}\r?\n/)), /if \(isWebDevOnlyModule\(key\) && actorRole !== TOP_ROLE\) continue;/);
  assert.equal([...actions.matchAll(/setModuleGrants\([^)]*me\.session\.role\)/g)].length, 2, "create and update pass the actor role");
  assert.match(actions, /setModuleGrants\(key, \[\], TOP_ROLE\)/, "delete only ever removes the deleted role's grants");
  assert.doesNotMatch(actions, /setModuleGrants\([^,)]*,[^,)]*\)/, "no call without the actor role");
});

test("saveModulePermissionAction refuses Web Dev-only modules for anyone below Web Dev", () => {
  const body = permissionActions.slice(permissionActions.indexOf("export async function saveModulePermissionAction"));
  const guard = body.indexOf("if (isWebDevOnlyModule(settingKey) && session.role !== TOP_ROLE)");
  assert.ok(guard > -1, "Web Dev-only guard present");
  assert.ok(guard < body.indexOf(".insert("), "guard runs before the write");
  assert.match(body, /Only Web Dev can change this permission\./);
});

test("role mutations refuse to run on the fallback catalogue", () => {
  for (const name of ["createRoleAction", "updateRoleAction", "reorderRolesAction", "deleteRoleAction"]) {
    const start = actions.indexOf(`export async function ${name}`);
    const next = actions.indexOf("export async function", start + 1);
    const body = actions.slice(start, next === -1 ? undefined : next);
    const refresh = body.indexOf("await refreshRoleCatalog();");
    const live = body.indexOf("if (!roleCatalogIsLive()) return CATALOG_NOT_LIVE;");
    const firstWrite = body.search(/\.insert\(|\.update\(|\.delete\(/);
    assert.ok(refresh > -1 && live > refresh && live < firstWrite, `${name} checks the catalogue is live before writing`);
  }
  assert.match(actions, /Roles can't be edited right now\. Try again in a moment\./);
});

test("the loader keeps the last good database catalogue and refresh forces a new load", () => {
  const loader = readFileSync(new URL("../data/roles.ts", import.meta.url), "utf8");
  assert.match(loader, /export function roleCatalogIsLive\(\): boolean \{\s*return state\.source === "database";\s*\}/);
  assert.match(loader, /function fallBackToBuiltIns\(\): void \{[\s\S]*?if \(state\.source === "database"\) return;\s*setRoleCatalog\(BUILTIN_ROLES\);/);
  assert.match(loader, /if \(defs\.length > 0 && setRoleCatalog\(defs\)\) \{\s*state\.source = "database";/);
  const refresh = loader.slice(loader.indexOf("export async function refreshRoleCatalog"));
  assert.match(refresh, /while \(state\.pending\) await state\.pending/);
});

test("staff tests use isStaff(), not a Helper rank gate", () => {
  const files = ["../data/accounts.ts", "../actions/user-admin.ts", "../actions/roles.ts", "../data/admin-overview.ts", "../../app/admin/users/page.tsx"];
  for (const file of files) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(src, /hasAtLeast\([^)]*"helper"\)/, file);
    assert.match(src, /isStaff\(/, file);
  }
});

test("every permission module has a Permissions page card, so the role checklist and the page list the same boards", () => {
  const permissions = readFileSync(new URL("../auth/permissions.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../app/admin/permissions/page.tsx", import.meta.url), "utf8");
  const list = permissions.match(/export const ALL_PERMISSION_KEYS = \[([\s\S]*?)\] as const;/);
  assert.ok(list, "ALL_PERMISSION_KEYS found");
  const names = list[1].split(",").map((name) => name.trim()).filter(Boolean);
  assert.ok(names.length > 0);
  for (const name of names) assert.ok(page.includes(`selected: perms[${name}].roles`), name);
  assert.equal((page.match(/selected: perms\[/g) ?? []).length, names.length, "no Permissions card outside ALL_PERMISSION_KEYS");
});
