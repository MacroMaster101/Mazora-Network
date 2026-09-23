import assert from "node:assert/strict";
import test from "node:test";
import { landingPathFor, roleKeys, staffRoleKeys } from "@/lib/auth/roles";

test("every rank, staff included, lands on the home page after login", () => {
  // Guard: the catalogue must include staff ranks, or this proves nothing.
  assert.ok(staffRoleKeys().length > 0);
  for (const role of roleKeys()) assert.equal(landingPathFor(role), "/", role);
});
