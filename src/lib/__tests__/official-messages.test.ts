/**
 * Messages that speak as Mazora itself: default notification templates, broadcast
 * withdrawal and the bot's staff notices. Below Owner none of them may be used
 * to word, silence or withdraw an official message, or to DM a guild member a
 * link or a fake termination.
 *
 * Run with: npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach } from "node:test";

import { BUILTIN_ROLES, setRoleCatalog } from "@/lib/auth/role-catalog-core";
import { isOfficialNotification, officialTemplateRefusal } from "@/lib/notification-authority";
import {
  readsAsOfficialAction,
  staffNoticeAuthorityRefusal,
  validateStaffNotice,
  type StaffNoticeInput,
} from "@/lib/staff-notices";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

beforeEach(() => setRoleCatalog(BUILTIN_ROLES));

/* ----------------------------------------------------- default templates */

test("a Mazora, system or security template is official", () => {
  assert.equal(isOfficialNotification({ sender: "mazora", category: "welcome" }), true);
  assert.equal(isOfficialNotification({ sender: "system", category: "support" }), true);
  assert.equal(isOfficialNotification({ sender: "staff", category: "security" }), true);
  assert.equal(isOfficialNotification({ sender: "staff", category: "support" }), false);
  assert.equal(isOfficialNotification({}), false);
});

test("below Owner an official template cannot be edited or toggled", () => {
  const sessionVerification = { sender: "mazora", category: "security" };
  for (const role of ["administrator", "senior_moderator", "moderator", "helper"]) {
    assert.match(officialTemplateRefusal(role, sessionVerification) ?? "", /Only owners can change/, role);
    assert.match(officialTemplateRefusal(role, { sender: "system", category: "support" }) ?? "", /Only owners/, role);
  }
  assert.equal(officialTemplateRefusal("administrator", { sender: "staff", category: "support" }), null);
  assert.match(
    officialTemplateRefusal("administrator", { sender: "staff", category: "support" }, { category: "security" }) ?? "",
    /Only owners can make a template/,
    "an ordinary template cannot be turned official",
  );
  assert.equal(officialTemplateRefusal("owner", sessionVerification), null);
  assert.equal(officialTemplateRefusal("web_dev", sessionVerification), null);
});

test("the template actions check the stored template before writing", () => {
  const source = read("../actions/notifications.ts");
  for (const name of ["updateNotificationTemplateAction", "setNotificationTemplateEnabledAction"]) {
    const body = source.slice(source.indexOf(`export async function ${name}`));
    const refusal = body.indexOf("storedTemplateRefusal(auth.session.role, parsed.data.id)");
    assert.ok(refusal > 0, `${name} checks`);
    assert.ok(refusal < body.indexOf("updateNotificationTemplate("), `${name} checks before writing`);
  }
  assert.match(source, /const stored = await getNotificationTemplate\(id\);/);
  assert.match(source, /return officialTemplateRefusal\(role, stored\);/);
  assert.match(source, /const templateToggleSchema = z\.object\(\{ id: templateIdSchema, enabled: z\.boolean\(\) \}\);/);
  const toggle = source.slice(source.indexOf("export async function setNotificationTemplateEnabledAction"));
  assert.match(toggle, /templateToggleSchema\.safeParse\(\{ id, enabled \}\)/);
  assert.match(toggle, /updateNotificationTemplate\(parsed\.data\.id, \{ enabled: parsed\.data\.enabled \}\)/);
});

test("a delegate cannot withdraw an owner's official broadcast", () => {
  const source = read("../actions/notifications.ts");
  const body = source.slice(source.indexOf("export async function deleteBroadcastNotificationAction"));
  const refusal = body.indexOf("officialNotificationRefusal(auth.session.role, existing)");
  assert.ok(refusal > 0);
  assert.ok(refusal < body.indexOf(".delete(schema.notificationBroadcasts)"), "checks before deleting");
});

test("the template editor and broadcast history hide what the server refuses", () => {
  const manager = read("../../components/admin/admin-broadcast-manager.tsx");
  assert.match(manager, /\{canSendOfficial \|\| !isOfficialNotification\(tpl\) \? \(/);
  assert.match(manager, /\{\(canSendOfficial \|\| !item\.official\) && \(/);
  assert.match(manager, /official: isOfficialNotification\(\{ sender: record\.sender, category: record\.category \}\),/);
  assert.match(manager, /sender: record\.sender,/);
});

/* ---------------------------------------------------------- staff notices */

function notice(overrides: Partial<StaffNoticeInput> = {}): StaffNoticeInput {
  return { template: "warning", username: "Steve_42", reason: "Spamming in chat after being asked to stop.", ...overrides };
}

test("below Owner a notice may not carry a link anywhere the sender typed", () => {
  const cases: Partial<StaffNoticeInput>[] = [
    { reason: "Appeal at https://example.com/login" },
    { reason: "Join discord.gg/notreally for help" },
    { template: "custom", customTitle: "Read https://example.com", reason: "See the title." },
    { titleOverride: "[Click here](https://example.com)" },
    { openingOverride: "Hi Steve_42, verify at http://example.com now." },
  ];
  for (const overrides of cases) {
    assert.match(staffNoticeAuthorityRefusal(notice(overrides), false) ?? "", /link/, JSON.stringify(overrides));
    assert.equal(staffNoticeAuthorityRefusal(notice(overrides), true), null, "owners keep links");
  }
});

test("a custom or edited notice cannot read as a termination, demotion or ban below Owner", () => {
  const titles = [
    "Staff Position Terminated",
    "T3rm1nated",
    "t e r m i n a t e d",
    "You have been demoted",
    "Removed from the staff team",
    "You are banned",
    "Account suspended",
    "Your permissions were revoked",
  ];
  for (const title of titles) {
    assert.equal(readsAsOfficialAction(title), true, title);
    assert.match(
      staffNoticeAuthorityRefusal(notice({ template: "custom", customTitle: title }), false) ?? "",
      /termination, demotion or ban/,
      title,
    );
    assert.match(staffNoticeAuthorityRefusal(notice({ titleOverride: title }), false) ?? "", /termination/, title);
    assert.match(staffNoticeAuthorityRefusal(notice({ openingOverride: title }), false) ?? "", /termination/, title);
    assert.equal(staffNoticeAuthorityRefusal(notice({ template: "custom", customTitle: title }), true), null);
  }
});

test("ordinary custom notices and warning reasons still go out below Owner", () => {
  for (const title of ["Schedule change", "Your report has been reviewed", "Urban build contest", "Kickoff event"]) {
    assert.equal(readsAsOfficialAction(title), false, title);
    assert.equal(staffNoticeAuthorityRefusal(notice({ template: "custom", customTitle: title }), false), null, title);
  }
  assert.equal(
    staffNoticeAuthorityRefusal(notice({ reason: "Repeating this could lead to a ban." }), false),
    null,
    "a reason may say what could follow",
  );
  assert.equal(staffNoticeAuthorityRefusal(notice({ template: "promotion", reason: "Helpful and active." }), false), null);
});

test("the termination template stays Owner-only, and validation fails closed", () => {
  assert.match(staffNoticeAuthorityRefusal(notice({ template: "terminated" }), false) ?? "", /Only an owner/);
  assert.equal(validateStaffNotice(notice({ template: "terminated" })).ok, false, "no rank given means not official");
  assert.deepEqual(validateStaffNotice(notice({ template: "terminated" }), { official: true }), { ok: true });
  assert.equal(validateStaffNotice(notice({ template: "custom", customTitle: "Staff Position Terminated" })).ok, false);
});

test("sendStaffNotice refuses before the rate limit and the Discord lookups", () => {
  const source = read("../actions/staff-notices.ts");
  const body = source.slice(source.indexOf("export async function sendStaffNotice"));
  const refusal = body.indexOf("staffNoticeAuthorityRefusal(input, official)");
  assert.ok(refusal > 0);
  assert.ok(refusal < body.indexOf("rateLimitShared("), "refused before the rate limit");
  assert.ok(refusal < body.indexOf("fetchGuildMember("), "refused before the guild lookup");
  assert.match(body, /const official = canSendOfficialNotifications\(session\.role\);/);
  assert.match(body, /validateStaffNotice\(notice, \{ official \}\)/);
});

test("the composer mirrors the staff notice refusal", () => {
  const composer = read("../../components/admin/bot-console/staff-notice-composer.tsx");
  assert.match(composer, /staffNoticeAuthorityRefusal\(\s*\{ template, reason, customTitle, titleOverride, openingOverride \},\s*canTerminate,\s*\)/);
  assert.match(composer, /&& !titleNeeded && !authorityRefusal;/);
  assert.match(composer, /disabled=\{sending \|\| Boolean\(authorityRefusal\)\}/);
});
