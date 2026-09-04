import assert from "node:assert/strict";
import test from "node:test";
import { describeBotAuditRow } from "../bot-activity-labels.js";

test("a delivered staff notice names the recipient and the sender", () => {
  const row = describeBotAuditRow("staff.notice", { username: "kaviyaz", by: "kldevsupport", delivered: true });
  assert.deepEqual(row, { kind: "notice", label: "Staff notice sent", detail: "kaviyaz", actor: "kldevsupport", ok: true });
});

test("a staff notice Discord refused is reported as failed, not sent", () => {
  // The audit row is written whether or not Discord cooperated. Reading
  // `delivered` back is the only way the panel can tell the two apart.
  const row = describeBotAuditRow("staff.notice", { username: "kaviyaz", by: "kldevsupport", delivered: false });
  assert.equal(row?.label, "Staff notice failed");
  assert.equal(row?.ok, false);
});

test("a granted Discord role reads as added, a revoked one as removed", () => {
  const added = describeBotAuditRow(
    "discord.role",
    { roleId: "123456789012345678", granted: true, applied: true, by: "kldevsupport" },
    "Verified",
  );
  assert.deepEqual(added, {
    kind: "role",
    label: "Discord role added",
    detail: "Verified",
    actor: "kldevsupport",
    ok: true,
  });

  const removed = describeBotAuditRow(
    "discord.role",
    { roleId: "123456789012345678", granted: false, applied: true, by: "kldevsupport" },
    "Verified",
  );
  assert.equal(removed?.label, "Discord role removed");
});

test("a role change Discord rejected is reported as failed", () => {
  // applied:false is the hierarchy refusal — the bot's role sits too low. It
  // must not read as a successful grant.
  const row = describeBotAuditRow(
    "discord.role",
    { roleId: "123456789012345678", granted: true, applied: false, by: "kldevsupport" },
    "Verified",
  );
  assert.equal(row?.label, "Discord role change failed");
  assert.equal(row?.ok, false);
});

test("a role removed on purpose is a success, not a failure", () => {
  // The console tints failures red. Revoking a role is a completed action, so
  // conflating "removed" with "refused" would cry wolf on every demotion.
  const row = describeBotAuditRow(
    "discord.role",
    { roleId: "123456789012345678", granted: false, applied: true, by: "kldevsupport" },
    "Verified",
  );
  assert.equal(row?.label, "Discord role removed");
  assert.equal(row?.ok, true);
});

test("an unresolved role name falls back to the id rather than showing nothing", () => {
  const row = describeBotAuditRow(
    "discord.role",
    { roleId: "123456789012345678", granted: true, applied: true, by: "kldevsupport" },
    null,
  );
  assert.equal(row?.detail, "123456789012345678");
});

test("a rank change shows who, from what, to what", () => {
  const row = describeBotAuditRow("role.change", {
    username: "kaviyaz",
    from: "member",
    to: "helper",
    by: "kldevsupport",
  });
  assert.deepEqual(row, {
    kind: "rank",
    label: "Rank changed",
    detail: "kaviyaz · member → helper",
    actor: "kldevsupport",
    ok: true,
  });
});

test("an unknown action is skipped rather than rendered blank", () => {
  // The query filters by action, but a row written by future code must never
  // reach the panel as an empty line.
  assert.equal(describeBotAuditRow("store.order.persist_failed", { by: "someone" }), null);
});

test("missing metadata degrades to nulls instead of throwing", () => {
  const row = describeBotAuditRow("staff.notice", null);
  assert.equal(row?.label, "Staff notice sent");
  assert.equal(row?.detail, null);
  assert.equal(row?.actor, null);
});
