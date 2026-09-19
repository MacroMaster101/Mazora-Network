import assert from "node:assert/strict";
import test from "node:test";
import { rankTier } from "@/components/admin/rank-chip";
import { BUILTIN_ROLES, setRoleCatalog, type RoleDef } from "@/lib/auth/role-catalog-core";
import type { Role } from "@/lib/types";

test("rankTier matches each built-in role's catalogue kind and rank", () => {
  const expected: Record<string, string> = {
    web_dev: "leadership",
    owner: "leadership",
    administrator: "leadership",
    senior_moderator: "staff",
    moderator: "staff",
    helper: "staff",
    vip: "supporter",
    sponsor: "supporter",
    member: "player",
    guest: "player",
  };
  for (const role of BUILTIN_ROLES) {
    assert.equal(rankTier(role.key as Role), expected[role.key], role.key);
  }
});

test("rankTier for an unknown role key falls back to player", () => {
  assert.equal(rankTier("not-a-role" as Role), "player");
});

test("rankTier for a custom staff role below Admin's rank is staff", () => {
  const custom: RoleDef = {
    key: "custom_guide",
    label: "Guide",
    color: "#a855f7",
    icon: null,
    description: "",
    kind: "staff",
    position: 450,
    locked: false,
    showOnTeam: false,
  };
  const defs = [...BUILTIN_ROLES, custom];
  const installed = setRoleCatalog(defs);
  assert.ok(installed, "custom staff role at position 450 should be a valid catalogue");
  try {
    assert.equal(rankTier("custom_guide" as Role), "staff");
  } finally {
    setRoleCatalog(BUILTIN_ROLES);
  }
});
