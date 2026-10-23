import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(`src/lib/actions/${file}`, "utf8").replace(/\r\n/g, "\n");

function body(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("every forum and category mutation is audited", () => {
  const source = read("forums-admin.ts");
  for (const action of [
    "forums.category.create", "forums.forum.create", "forums.category.update", "forums.forum.update",
    "forums.forum.reorder", "forums.category.reorder", "forums.forum.lock", "forums.forum.unlock",
    "forums.forum.delete", "forums.category.delete",
  ]) {
    assert.ok(source.includes(`"${action}"`), action);
  }
});

test("deleting a forum removes the row before the stored files", () => {
  const fn = body(read("forums-admin.ts"), "deleteForumAction");
  const deleteAt = fn.indexOf(".delete(schema.forums)");
  assert.ok(deleteAt > 0);
  assert.ok(deleteAt < fn.indexOf("storage.from(NEWS_IMAGE_BUCKET).remove"));
  assert.ok(fn.indexOf("forumPostImages") < deleteAt, "keys are read before the cascade");
});

test("account deletion cleans up before the auth delete and audits without throwing", () => {
  const admin = body(read("user-admin.ts"), "deleteUserAction");
  assert.ok(admin.indexOf("cleanupAccountOwnedData") < admin.indexOf("deleteUser("));
  assert.ok(admin.includes('"user.delete.failed"'));
  assert.ok(!admin.includes("auditLogs"), "post-deletion audit goes through the non-throwing helper");
  assert.ok(admin.includes('action: "user.delete"'));
  assert.ok(body(read("user-admin.ts"), "resendInviteAction").includes('"user.invite.resend"'));
  assert.ok(read("account.ts").includes('"account.delete.failed"'));
});

test("locked roles can only be restyled by the top role", () => {
  const fn = body(read("role-catalog.ts"), "updateRoleAction");
  assert.match(fn, /role\.locked\s*&&\s*me\.session\.role !== TOP_ROLE/);
});

test("event delete audits the stored title; saves cap rewards and validate dates", () => {
  const source = read("events-admin.ts");
  const del = body(source, "deleteEventAction");
  assert.ok(!del.includes('formData.get("title")'));
  assert.ok(del.includes(".returning({ title: schema.events.title })"));
  assert.ok(source.includes("Keep rewards under 1,000 characters."));
  assert.ok(source.includes("The end must be after the start."));
  assert.ok(source.includes("Number.isNaN(startDate.getTime())"));
});

test("gallery categories are limited to the known list", () => {
  const source = read("gallery.ts");
  assert.ok(source.includes('["builds", "events", "spawns", "community"]'));
  assert.equal((source.match(/readCategory\(formData\)/g) ?? []).length, 2);
  assert.ok(!source.includes('clean(formData.get("category"), 40)') || source.indexOf('clean(formData.get("category"), 40)') < source.indexOf("function readCategory") + 200);
});

test("member actions require an active session, not just a session id", () => {
  assert.ok(body(read("gallery.ts"), "toggleGalleryLikeAction").includes("await getSession()"));
  const notifications = read("notifications.ts");
  for (const name of ["listMyNotificationsAction", "setNotificationReadAction", "setAllNotificationsReadAction", "deleteNotificationAction"]) {
    const fn = body(notifications, name);
    assert.ok(fn.includes("activeUserId()"), name);
    assert.ok(!fn.includes("getSessionUserId()"), name);
  }
  const guide = read("site-guide.ts");
  assert.ok(body(guide, "markSiteGuideSeen").includes("activeUserId()"));
});
