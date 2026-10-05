import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isPendingInvite } from "../auth/pending-invite";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("a staff rank is refused for an unconfirmed account that is not a staff invite", () => {
  const src = read("../actions/roles.ts");
  const action = src.slice(src.indexOf("export async function changeUserRole"));

  const guard = action.indexOf("becomesStaff && !target.user.email_confirmed_at && !isPendingInvite(target.user)");
  assert.ok(guard > 0, "the guard exists");
  assert.match(
    action,
    /This account has not confirmed its email yet\. Ask them to confirm it before giving it a staff rank\./,
  );

  // After the permission and rank checks, before anything is written.
  for (const gate of ["canAssignRoles(session, actorId)", "canManageRank(session.role, currentRole)", "canGrantRank(session.role, newRole)"]) {
    const at = action.indexOf(gate);
    assert.ok(at > 0 && at < guard, `${gate} runs before the guard`);
  }
  for (const write of ["updateUserById(", "db.update(", "db.insert("]) {
    const at = action.indexOf(write);
    assert.ok(at > guard, `${write} runs after the guard`);
  }

  // Reuses the already-loaded target rather than a second lookup.
  assert.equal(action.split("getUserById(").length - 1, 1);
});

test("the pending-invite check is shared, not duplicated", () => {
  assert.match(read("../actions/roles.ts"), /import \{ isPendingInvite \} from "@\/lib\/auth\/pending-invite";/);
  assert.match(read("../actions/user-admin.ts"), /import \{ isPendingInvite \} from "@\/lib\/auth\/pending-invite";/);
  assert.doesNotMatch(read("../actions/user-admin.ts"), /function isPendingInvite/);
  assert.doesNotMatch(read("../auth/pending-invite.ts"), /^\s*["']use server["']/m);
});

test("isPendingInvite is true only for an invited, never-used, unconfirmed account", () => {
  assert.equal(isPendingInvite({ invited_at: "2026-01-01T00:00:00Z" }), true);
  assert.equal(isPendingInvite({}), false);
  assert.equal(isPendingInvite({ invited_at: "2026-01-01T00:00:00Z", last_sign_in_at: "2026-01-02T00:00:00Z" }), false);
  assert.equal(isPendingInvite({ invited_at: "2026-01-01T00:00:00Z", email_confirmed_at: "2026-01-02T00:00:00Z" }), false);
});
