import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { summarise } from "@/lib/audit-subject";

test("rank changes read as who went from what to what", () => {
  assert.equal(summarise("roles.assign", "user", "id", { username: "Steve_42", from: "member", to: "helper" }), "Steve_42: member → helper");
});

test("a deleted account keeps no name, but says what kind of account it was", () => {
  assert.equal(summarise("user.delete", "user", null, { deletedRole: "moderator", by: "StaffAlex" }), "Deleted account (moderator)");
  // Older rows written before names stopped being kept still show theirs.
  assert.equal(summarise("user.delete", "user", null, { username: "Alex_Builder", role: "member" }), "Alex_Builder (member)");
});

test("store changes are named from their before/after snapshot", () => {
  assert.equal(summarise("store.product.update", "product", "id", { before: { name: "Old" }, after: { name: "Hero Rank" } }), "Hero Rank");
  assert.equal(summarise("store.product.delete", "product", "id", { before: { name: "Hero Rank" } }), "Hero Rank");
});

test("settings read as the page or category they belong to, not as values inside them", () => {
  assert.equal(summarise("site.general.update", "setting", "site.general", { after: { name: "Example Network" } }), "Site settings");
  assert.equal(summarise("news.permissions.update", "setting", "news.permissions", {}), "News permissions");
  assert.equal(summarise("store.subcategory.create", "setting", "survival-smp:Cosmetics:Armor Skins", {}), "Cosmetics › Armor Skins (Survival SMP)");
});

test("codes, orders and invoices read as their own reference", () => {
  assert.equal(summarise("creator_code.save", "creator_code", "id", { code: "SAVE10", creatorName: "Steve_42" }), "SAVE10 (Steve_42)");
  assert.equal(summarise("order.delete", "order", null, { reference: "MZ-20260101-ABC123" }), "Order MZ-20260101-ABC123");
  assert.equal(summarise("store.invoice.save", "order", "id", { invoiceNo: "MZ-20260101-DEF456" }), "Invoice MZ-20260101-DEF456");
});

test("security events say what happened", () => {
  assert.equal(summarise("auth.two_factor_enabled", "mfa_factor", "id", { by: "Steve_42" }), "Authenticator app enabled");
  assert.equal(summarise("auth.two_factor_recovery_used", "user", "id", { remaining: 9 }), "Recovery code used (9 left)");
  assert.equal(summarise("auth.passkey_added", "user", "id", { passkeyId: "x" }), "Passkey added");
});

test("a row that recorded only an id has no subject here, so the reader looks it up", () => {
  assert.equal(summarise("news.approve", "news", "00000000-0000-4000-8000-000000000001", { by: "StaffAlex" }), null);
  assert.equal(summarise("user.minecraft.release", "user", "00000000-0000-4000-8000-000000000002", { by: "StaffAlex" }), null);
});

test("an account deletion records the username, and still no email or account id", () => {
  const admin = readFileSync(new URL("../actions/user-admin.ts", import.meta.url), "utf8");
  const start = admin.indexOf('action: "user.delete"');
  const row = admin.slice(start, admin.indexOf("});", start));
  assert.match(row, /targetId: null/, "no account id");
  assert.match(row, /metadata: \{ username: targetName, deletedRole: targetRole, by: session\.username \}/);
  assert.doesNotMatch(row, /email/, "no email");
});
