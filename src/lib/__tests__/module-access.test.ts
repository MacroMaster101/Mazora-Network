import assert from "node:assert/strict";
import test from "node:test";
import { canAccessModule } from "../auth/module-access-shared.js";

const normal = { itOnly: false, configuredRoles: [] as const, configuredUserIds: [] as const };
const itOnly = { itOnly: true, configuredRoles: [] as const, configuredUserIds: [] as const };

test("a signed-out visitor is refused everything", () => {
  assert.equal(canAccessModule(null, normal), false);
  assert.equal(canAccessModule(null, itOnly), false);
});

test("it reaches everything, including an IT-only module", () => {
  // TOP_ROLE has nobody above it to appeal to. If it could be locked out of a
  // module, nobody could unlock it.
  assert.equal(canAccessModule("it", normal), true);
  assert.equal(canAccessModule("it", itOnly), true);
});

test("an owner keeps blanket access to ordinary modules", () => {
  // This is the pre-existing short-circuit. All seventeen ordinary modules
  // must behave exactly as before this change.
  assert.equal(canAccessModule("owner", normal), true);
  assert.equal(canAccessModule("administrator", normal), false);
});

test("an owner is refused an IT-only module — the whole point of the change", () => {
  assert.equal(canAccessModule("owner", itOnly), false);
});

test("an owner granted an IT-only module explicitly does get in", () => {
  // So IT can hand audit to an owner from the permissions page, and the grant
  // takes effect through the ordinary configured-roles path.
  assert.equal(
    canAccessModule("owner", { itOnly: true, configuredRoles: ["owner"], configuredUserIds: [] }),
    true,
  );
});

test("a configured role reaches a module it is listed on", () => {
  assert.equal(
    canAccessModule("helper", { itOnly: false, configuredRoles: ["helper"], configuredUserIds: [] }),
    true,
  );
  assert.equal(
    canAccessModule("moderator", { itOnly: false, configuredRoles: ["helper"], configuredUserIds: [] }),
    false,
  );
});

test("an individually granted user reaches a module their role does not", () => {
  assert.equal(
    canAccessModule("helper", {
      itOnly: false,
      configuredRoles: [],
      configuredUserIds: ["user-1"],
      userId: "user-1",
    }),
    true,
  );
  assert.equal(
    canAccessModule("helper", {
      itOnly: false,
      configuredRoles: [],
      configuredUserIds: ["user-1"],
      userId: "user-2",
    }),
    false,
  );
});

test("an individual grant on an IT-only module is honoured", () => {
  assert.equal(
    canAccessModule("moderator", {
      itOnly: true,
      configuredRoles: [],
      configuredUserIds: ["user-9"],
      userId: "user-9",
    }),
    true,
  );
});

test("an owner is still refused audit when the module's own list is the real one", () => {
  // The bug this guards: ALWAYS_ALLOWED = ["owner","it"] was force-injected
  // into EVERY module's roles on read and write, so configuredRoles always
  // contained "owner" and the fall-through granted it — defeating IT-only
  // silently, through the very mechanism meant to guarantee access. The
  // earlier tests missed it because they passed an empty configuredRoles,
  // which never occurs in production.
  assert.equal(
    canAccessModule("owner", { itOnly: true, configuredRoles: ["it"], configuredUserIds: [] }),
    false,
  );
  assert.equal(
    canAccessModule("it", { itOnly: true, configuredRoles: ["it"], configuredUserIds: [] }),
    true,
  );
});
