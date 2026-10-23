import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach } from "node:test";

import { BUILTIN_ROLES, setRoleCatalog } from "@/lib/auth/role-catalog-core";
import { INTERNAL_ROLE, publicRole } from "@/lib/auth/roles";
import {
  canSendOfficialNotifications,
  isOfficialCategory,
  officialNotificationRefusal,
} from "@/lib/notification-authority";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

beforeEach(() => setRoleCatalog(BUILTIN_ROLES));

/* ---------------------------------------------------- Web Dev stays internal */

test("the public sees Web Dev as a member and every other rank as itself", () => {
  assert.equal(INTERNAL_ROLE, "web_dev");
  assert.equal(publicRole("web_dev"), "member");
  for (const role of ["owner", "administrator", "moderator", "helper", "vip", "member"]) {
    assert.equal(publicRole(role), role);
  }
});

test("every public loader that carries a rank passes it through publicRole", () => {
  for (const path of ["../data/forums.ts", "../data/suggestions-board.ts"]) {
    assert.match(read(path), /return isRoleKey\(role\) \? publicRole\(role\) : "member";/, path);
  }
  assert.match(read("../data/presence.ts"), /const role = isRoleKey\(storedRole\) \? publicRole\(storedRole\) : "member";/);
  assert.match(read("../data/directory-merge.ts"), /role: publicRole\(account\.role\),/);
  assert.match(read("../data/accounts.ts"), /account\.role !== INTERNAL_ROLE &&/);
});

test("bylines never name the Web Dev rank", () => {
  const content = read("../data/content.ts");
  assert.match(content, /bylineRole\(normalizeRoleKey\(liveAuthor\.role\)\)/);
  assert.match(content, /return publicRole\(role\) === role \? roleLabel\(role\) : "News Publisher";/);
  assert.match(content, /label === roleLabel\(INTERNAL_ROLE\) \? undefined : label/, "older stored snapshots are dropped too");
  assert.match(read("../actions/news.ts"), /session && publicRole\(session\.role\) === session\.role \? roleLabel\(session\.role\) : "News Publisher"/);
  assert.match(read("../data/patches.ts"), /if \(!role \|\| role === INTERNAL_ROLE\) return undefined;/);
  assert.match(read("../../app/admin/play/page.tsx"), /publicRole\(session\.role\) === session\.role \? roleLabel\(session\.role\) : "Official Team"/);
});

/* ------------------------------------------ suspended members off the list */

test("the public player list only takes Minecraft links from active accounts", () => {
  const source = read("../data/minecraft-accounts.ts");
  const list = source.slice(source.indexOf("export const listLinkedAccounts"), source.indexOf("export async function getLinkedSkin"));
  assert.match(list, /\.innerJoin\(schema\.profiles, eq\(schema\.profiles\.userId, schema\.minecraftAccounts\.userId\)\)/);
  assert.match(list, /\.where\(eq\(schema\.profiles\.accountStatus, "active"\)\)/);
  // The auth id still never leaves the module: only the public fields are selected.
  assert.doesNotMatch(list, /userId: schema/);
});

/* ------------------------------------------------ Minecraft name throttling */

test("linking a Minecraft name shares the avatar action's ign-claim limit", () => {
  const minecraft = read("../actions/minecraft.ts");
  const link = minecraft.slice(minecraft.indexOf("export async function linkMinecraftUsernameAction"));
  const throttle = link.indexOf('throttleAuthAction("ign-claim", {');
  assert.ok(throttle > 0, "throttled");
  assert.ok(throttle < link.indexOf("ignAvailability("), "before the lookup that answers taken / not taken");
  assert.match(link, /limit: 5,\s*windowMs: 60 \* 60_000,\s*identity: user\.id,/);
  assert.match(read("../actions/avatar.ts"), /throttleAuthAction\("ign-claim", \{\s*limit: 5,\s*windowMs: 60 \* 60_000,/);
});

/* ---------------------------------------------- per-account rate limit keys */

test("per-account limits key on the account alone, never the address", () => {
  const limiter = read("../rate-limit.ts");
  assert.match(limiter, /export function accountKey\(scope: string, accountId: string\): string \{\s*return `\$\{scope\}:account:\$\{hashed\(accountId\.trim\(\)\.toLowerCase\(\)\)\}`;/);
  assert.match(limiter, /export async function actionClientKey\(scope: string\): Promise<string>/, "the address key takes no identity");

  const scopes = {
    "../actions/forums.ts": ["forum-topic", "forum-post", "forum-report", "comment-vote"],
    "../actions/suggestions.ts": ["suggestion-reply", "suggestion-vote", "suggestion-lock", "comment-vote"],
    "../actions/reports.ts": ["content-report", "report-resolve"],
    "../actions/event-registrations.ts": ["event-register"],
    "../actions/notifications.ts": ["notification-broadcast", "notification-direct"],
    "../actions/staff-notices.ts": ["staff-notice", "discord-member-search", "recipient-context"],
    "../actions/presence.ts": ["presence-status"],
    "../actions/forums-admin.ts": ["forum-report-close"],
  };
  for (const [path, list] of Object.entries(scopes)) {
    const source = read(path);
    assert.doesNotMatch(source, /actionClientKey\(/, `${path} has no address-mixed key left`);
    for (const scope of list) assert.match(source, new RegExp(`accountKey\\("${scope}", `), `${path}: ${scope}`);
  }
});

/* ------------------------------------------- official-looking notifications */

test("only owners and above may speak as Mazora", () => {
  assert.equal(canSendOfficialNotifications("owner"), true);
  assert.equal(canSendOfficialNotifications("web_dev"), true);
  for (const role of ["administrator", "senior_moderator", "moderator", "helper", "member"]) {
    assert.equal(canSendOfficialNotifications(role), false, role);
  }
  assert.equal(isOfficialCategory("security"), true);
  assert.equal(isOfficialCategory("announcement"), false);
});

test("below Owner: no Mazora or system sender, no security notice, no off-site link", () => {
  const staff = "administrator";
  assert.match(officialNotificationRefusal(staff, { sender: "mazora", category: "announcement" }) ?? "", /Only owners can send as the Mazora Team/);
  assert.match(officialNotificationRefusal(staff, { sender: "system", category: "announcement" }) ?? "", /Mazora Team/);
  assert.match(officialNotificationRefusal(staff, { sender: "staff", category: "security" }) ?? "", /security notices/);
  assert.match(
    officialNotificationRefusal(staff, { sender: "staff", category: "announcement", href: "https://example.com/login" }) ?? "",
    /link outside the site/,
  );
  assert.equal(officialNotificationRefusal(staff, { sender: "staff", category: "announcement", href: "/news" }), null);
  assert.equal(officialNotificationRefusal(staff, { sender: "staff", category: "event", href: "" }), null);

  assert.equal(
    officialNotificationRefusal("owner", { sender: "mazora", category: "security", href: "https://example.com/" }),
    null,
    "owners keep every option",
  );
});

test("the notification actions refuse before anything is written", () => {
  const source = read("../actions/notifications.ts");
  for (const name of ["sendBroadcastNotificationAction", "sendDirectNotificationAction"]) {
    const body = source.slice(source.indexOf(`export async function ${name}`));
    const refusal = body.indexOf("officialNotificationRefusal(auth.session.role, parsed.data)");
    assert.ok(refusal > 0, `${name} checks`);
    assert.ok(refusal < body.indexOf(".insert("), `${name} checks before inserting`);
  }
  const edit = source.slice(source.indexOf("export async function updateBroadcastNotificationAction"));
  assert.ok(edit.indexOf("officialNotificationRefusal(auth.session.role, { category: parsed.data.category })") > 0);
  assert.ok(
    edit.indexOf("officialNotificationRefusal(auth.session.role, existing)") < edit.indexOf(".update(schema.notificationBroadcasts)"),
    "an owner's official broadcast is not rewritten below Owner",
  );
  assert.match(read("../actions/staff-notices.ts"), /sender: canSendOfficialNotifications\(session\.role\) \? "mazora" : "staff",/);
});

test("the composer hides what the server would refuse", () => {
  const composer = read("../../components/admin/admin-broadcast-manager.tsx");
  assert.match(composer, /useState<"mazora" \| "account">\(canSendOfficial \? "mazora" : "account"\)/);
  assert.match(composer, /useState<"account" \| "mazora">\(canSendOfficial \? "mazora" : "account"\)/);
  assert.equal(composer.match(/disabled=\{!canSendOfficial\}/g)?.length, 2, "both Mazora Team buttons");
  assert.match(composer, /\{canSendOfficial && <option value="security">/);
  assert.match(composer, /canSendOfficial \|\| !isOfficialCategory\(t\.category\)/);
  assert.match(read("../../app/admin/notifications/page.tsx"), /canSendOfficial=\{canSendOfficialNotifications\(session\.role\)\}/);
});
