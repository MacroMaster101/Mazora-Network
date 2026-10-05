import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("an invite is refused when the address already has a non-pending account", () => {
  const src = read("../actions/user-admin.ts");
  const invite = src.slice(
    src.indexOf("export async function inviteUserAction"),
    src.indexOf("export async function resendInviteAction"),
  );
  const lookup = invite.indexOf("listAllAuthUsers(admin)");
  const send = invite.indexOf("inviteUserByEmail(");
  assert.ok(lookup > 0 && send > 0 && lookup < send, "the account lookup runs before the invite is sent");

  // The new check sits after the existing gates, not in front of them.
  for (const gate of ["requireOwner()", "canAssignRoles(session, actorId)", "canGrantRank(session.role, role)"]) {
    const at = invite.indexOf(gate);
    assert.ok(at > 0 && at < lookup, `${gate} still runs before the lookup`);
  }

  assert.match(invite, /user\.email\?\.trim\(\)\.toLowerCase\(\) === invitedEmail/);
  assert.match(invite, /existing && !isPendingInvite\(existing\)/);
  const refusal = invite.indexOf("existing && !isPendingInvite(existing)");
  assert.ok(refusal > lookup && refusal < send, "the refusal runs before the invite is sent");
  assert.match(
    invite,
    /An account already exists for that email\. Change its rank from the Users list instead\./,
  );
});

test("re-inviting a pending invite obeys the rank ceiling of the invite as it stands", () => {
  const src = read("../actions/user-admin.ts");
  const invite = src.slice(
    src.indexOf("export async function inviteUserAction"),
    src.indexOf("export async function setStaffPublicVisibilityAction"),
  );
  // Judged on the rank the existing invite holds, not the one being asked for.
  const current = invite.indexOf("normalizeRoleKey(existing.app_metadata?.role)");
  const ceiling = invite.indexOf("if (!canManageRank(session.role, currentRole))");
  assert.ok(current > 0 && ceiling > current, "the ceiling is checked against the invite's current rank");
  // Only reached for a pending invite: everything else was refused just above.
  assert.ok(ceiling > invite.indexOf("existing && !isPendingInvite(existing)"));
  // Before the invite is sent again and before the rank is re-stamped.
  assert.ok(ceiling < invite.indexOf("inviteUserByEmail("), "before the invite is re-sent");
  assert.ok(ceiling < invite.indexOf("updateUserById("), "before the rank is re-stamped");
  // The same check the other invite actions make.
  for (const name of ["resendInviteAction", "revokeInviteAction"]) {
    const start = src.indexOf(`export async function ${name}`);
    assert.match(src.slice(start, src.indexOf("\n}\n", start)), /if \(!canManageRank\(session\.role, targetRole\)\)/, name);
  }
});

test("an unconfirmed sign-up is told to be deleted, not promoted", () => {
  const src = read("../actions/user-admin.ts");
  const invite = src.slice(
    src.indexOf("export async function inviteUserAction"),
    src.indexOf("export async function resendInviteAction"),
  );
  const send = invite.indexOf("inviteUserByEmail(");
  const confirmed = "An account already exists for that email. Change its rank from the Users list instead.";
  const unconfirmed =
    "An unconfirmed sign-up already exists for that email. Delete it from the Users list, then send the invite again.";
  const confirmedAt = invite.indexOf(confirmed);
  const unconfirmedAt = invite.indexOf(unconfirmed);
  assert.ok(confirmedAt > 0 && confirmedAt < send, "the confirmed-account refusal runs before the invite is sent");
  assert.ok(unconfirmedAt > 0 && unconfirmedAt < send, "the unconfirmed-account refusal runs before the invite is sent");
  // The unconfirmed message is chosen by the existing account's confirmation state.
  assert.match(invite, /if \(!existing\.email_confirmed_at\) \{\s*return \{\s*ok: false,\s*message:\s*"An unconfirmed sign-up/);
  assert.ok(
    invite.indexOf("if (!existing.email_confirmed_at)") < unconfirmedAt &&
      unconfirmedAt < confirmedAt,
    "the unconfirmed branch comes first, the confirmed message is the fall-through",
  );
});

test("an invite fails closed when the account lookup errors", () => {
  const src = read("../actions/user-admin.ts");
  const invite = src.slice(
    src.indexOf("export async function inviteUserAction"),
    src.indexOf("export async function resendInviteAction"),
  );
  const start = invite.indexOf("if (lookupError || lookupTruncated)");
  assert.ok(start > 0 && start < invite.indexOf("inviteUserByEmail("), "the check runs before the invite is sent");
  // The branch body: from the condition to its closing brace.
  const branch = invite.slice(start, invite.indexOf("\n  }\n", start));
  assert.match(
    branch,
    /return \{\s*ok: false,\s*message: "Could not check whether that email already has an account\. Try again\.",\s*\};/,
  );
});

test("an invite refuses when the account list was cut short at the page ceiling", () => {
  const accounts = read("../data/accounts.ts");
  const list = accounts.slice(accounts.indexOf("export async function listAllAuthUsers"), accounts.indexOf("async function discordIdentityMap"));
  // Only set when the final allowed page was still full.
  assert.match(list, /if \(batch\.length < USER_PAGE_SIZE\) break;\s*if \(page === USER_PAGE_LIMIT\) truncated = true;/);
  assert.match(list, /return \{ users, error: null, truncated \};/);
  assert.match(list, /truncated: boolean/);

  const src = read("../actions/user-admin.ts");
  const invite = src.slice(
    src.indexOf("export async function inviteUserAction"),
    src.indexOf("export async function resendInviteAction"),
  );
  assert.match(invite, /truncated: lookupTruncated/);
  assert.match(invite, /if \(lookupError \|\| lookupTruncated\)/);
});

test("the recovery pepper warning is production-only and logged once per instance", () => {
  const src = read("../auth/recovery-codes.ts");
  assert.match(src, /let warnedMissingPepper = false;/);
  assert.match(
    src,
    /!pepper && process\.env\.NODE_ENV === "production" && !warnedMissingPepper/,
  );
  assert.match(src, /warnedMissingPepper = true;/);
  assert.match(src, /MFA_RECOVERY_PEPPER is not set/);
  // The legacy fallback stays: unset still hashes without the pepper.
  assert.match(src, /pepper \? hashRecoveryCodeKeyed\(pepper, userId, code\) : hashRecoveryCode\(userId, code\)/);
  // Nothing secret reaches the log line.
  const warning = src.slice(src.indexOf("console.error("), src.indexOf(");", src.indexOf("console.error(")));
  assert.match(warning, /^console\.error\(\s*"[^"]*",?\s*$/);
  assert.doesNotMatch(warning, /\$\{|process\.env|,\s*pepper|,\s*code/);
});
