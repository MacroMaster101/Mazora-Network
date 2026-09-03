import assert from "node:assert/strict";
import test from "node:test";
import { canGrantRank, canManageRank, ROLES, TOP_ROLE } from "../auth/roles.js";

test("nobody may grant a rank at or above their own", () => {
  assert.equal(canGrantRank("administrator", "administrator"), false);
  assert.equal(canGrantRank("administrator", "owner"), false);
  assert.equal(canGrantRank("administrator", "senior_moderator"), true);
});

test("it is exempt and may grant anything", () => {
  // TOP_ROLE has nobody above it to appeal to, so it short-circuits both guards.
  assert.equal(canGrantRank("it", "owner"), true);
  assert.equal(canGrantRank("it", "it"), true);
});

test("nobody may manage an account at or above their own rank", () => {
  assert.equal(canManageRank("administrator", "administrator"), false);
  assert.equal(canManageRank("administrator", "owner"), false);
  assert.equal(canManageRank("owner", "administrator"), true);
});

test("an administrator's grantable set stops below administrator", () => {
  // Verifies canGrantRank's behaviour over a small hand-picked sample of
  // ranks around "administrator". This array is NOT the production candidate
  // list and does not pin the composer's dropdown or any other UI's set —
  // see the "whole ladder" test below for the comprehensive invariant.
  const grantable = ["helper", "moderator", "senior_moderator", "administrator", "owner"].filter((role) =>
    canGrantRank("administrator", role as Parameters<typeof canGrantRank>[1]),
  );
  assert.deepEqual(grantable, ["helper", "moderator", "senior_moderator"]);
});

test("the whole ladder allows granting strictly below, with it exempt", () => {
  // Comprehensive invariant check: every actor on the ladder must be able to grant
  // roles strictly below their own rank and no others, except TOP_ROLE ("it") which
  // grants anything. This protects against bugs in other tiers that the 4-test suite
  // would miss if they only tested administrator.

  for (const actor of ROLES) {
    const actorRank = ROLES.indexOf(actor);

    for (const candidate of ROLES) {
      const candidateRank = ROLES.indexOf(candidate);

      if (actor === TOP_ROLE) {
        // "it" is exempt and may grant anything, including itself
        assert.equal(
          canGrantRank(actor, candidate),
          true,
          `canGrantRank("${actor}", "${candidate}") should be true for TOP_ROLE`,
        );
      } else {
        // Everyone else may grant strictly below their own rank
        const expected = candidateRank < actorRank;
        assert.equal(
          canGrantRank(actor, candidate),
          expected,
          `canGrantRank("${actor}", "${candidate}") should be ${expected} (candidate rank ${candidateRank}, actor rank ${actorRank})`,
        );
      }
    }
  }

  // Same invariant for canManageRank
  for (const actor of ROLES) {
    const actorRank = ROLES.indexOf(actor);

    for (const target of ROLES) {
      const targetRank = ROLES.indexOf(target);

      if (actor === TOP_ROLE) {
        // "it" is exempt and may manage anything
        assert.equal(
          canManageRank(actor, target),
          true,
          `canManageRank("${actor}", "${target}") should be true for TOP_ROLE`,
        );
      } else {
        // Everyone else may manage strictly below their own rank
        const expected = targetRank < actorRank;
        assert.equal(
          canManageRank(actor, target),
          expected,
          `canManageRank("${actor}", "${target}") should be ${expected} (target rank ${targetRank}, actor rank ${actorRank})`,
        );
      }
    }
  }
});
