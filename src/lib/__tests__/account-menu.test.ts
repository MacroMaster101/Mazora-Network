import assert from "node:assert/strict";
import test from "node:test";
import { ROLES, isStaff } from "@/lib/auth/roles";
import { accountMenuFor } from "@/lib/account-menu";

const hrefsFor = (role: (typeof ROLES)[number]) => accountMenuFor(role).map((entry) => entry.href);

test("every role reaches its own account screens", () => {
  for (const role of ROLES) {
    const hrefs = hrefsFor(role);
    assert.ok(hrefs.includes("/dashboard"), `${role} cannot reach /dashboard`);
    assert.ok(hrefs.includes("/dashboard/settings"), `${role} cannot reach settings`);
  }
});

test("notifications are left to the header bell, not duplicated in the menu", () => {
  for (const role of ROLES) {
    assert.ok(
      !hrefsFor(role).includes("/dashboard/notifications"),
      `${role} has a redundant notifications entry`,
    );
  }
});

test("the Control Room is offered to staff and withheld from everyone else", () => {
  const withControlRoom = ROLES.filter((role) => hrefsFor(role).includes("/admin"));
  assert.deepEqual(withControlRoom, ["helper", "moderator", "senior_moderator", "administrator", "owner", "it"]);
  // The staff boundary is the one thing that varies, so pin it to isStaff.
  assert.deepEqual(withControlRoom, ROLES.filter(isStaff));
});

test("no role is offered the same destination twice", () => {
  for (const role of ROLES) {
    const hrefs = hrefsFor(role);
    assert.equal(new Set(hrefs).size, hrefs.length, `${role} has a duplicated destination`);
  }
});

test("every entry is a same-origin path with a label and a known icon", () => {
  const icons = new Set(["control-room", "dashboard", "settings"]);
  for (const role of ROLES) {
    for (const entry of accountMenuFor(role)) {
      assert.ok(entry.label.trim().length > 0, `${role} has an unlabelled entry`);
      assert.ok(entry.href.startsWith("/") && !entry.href.startsWith("//"), `${role} has an off-origin href`);
      assert.ok(icons.has(entry.icon), `${role} has an unknown icon "${entry.icon}"`);
    }
  }
});

test("non-staff roles see exactly the personal screens, with no Control Room", () => {
  for (const role of ["guest", "member", "sponsor", "vip"] as const) {
    assert.deepEqual(hrefsFor(role), ["/dashboard", "/dashboard/settings"]);
  }
});

test("staff roles see the Control Room first, then the personal screens", () => {
  for (const role of ["helper", "moderator", "senior_moderator", "administrator", "owner", "it"] as const) {
    assert.deepEqual(hrefsFor(role), ["/admin", "/dashboard", "/dashboard/settings"]);
  }
});
