/**
 * Targeted tests for the pure logic that decides who may do what, where a
 * visitor may be sent, and which origin the site advertises to Google.
 *
 * These four are here because each is a single function whose failure mode is
 * severe and silent: a privilege-escalation hole, an open redirect, a
 * wrong-account identity, or every canonical URL on the site pointing at the
 * wrong host. Nothing that merely needs a database or a request is tested here
 * — that belongs in an integration test, and a mock-heavy unit test of it would
 * assert the mock rather than the behaviour.
 *
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { canGrantRank, canManageRank, hasAtLeast, isAdmin, isStaff, ROLES, TOP_ROLE } from "@/lib/auth/roles";
import { pickDiscordIdentity } from "@/lib/auth/discord-identity";
import { safeNext } from "@/lib/safe-redirect";
import { resolvePublicOrigin } from "@/lib/site";

describe("role ladder", () => {
  test("hasAtLeast is ordered by the documented ranking", () => {
    assert.equal(hasAtLeast("owner", "administrator"), true);
    assert.equal(hasAtLeast("administrator", "owner"), false);
    assert.equal(hasAtLeast("member", "member"), true);
    assert.equal(hasAtLeast("guest", "member"), false);
  });

  test("isStaff is helper and above, and excludes paying ranks", () => {
    assert.equal(isStaff("helper"), true);
    assert.equal(isStaff("moderator"), true);
    assert.equal(isStaff("it"), true);
    // vip/sponsor outrank member but are customers, not staff — if this ever
    // flips, every /admin board opens to anyone who bought a rank.
    assert.equal(isStaff("vip"), false);
    assert.equal(isStaff("sponsor"), false);
    assert.equal(isStaff("member"), false);
    assert.equal(isStaff("guest"), false);
  });

  test("isAdmin is administrator and above", () => {
    assert.equal(isAdmin("administrator"), true);
    assert.equal(isAdmin("owner"), true);
    assert.equal(isAdmin("it"), true);
    assert.equal(isAdmin("senior_moderator"), false);
    assert.equal(isAdmin("moderator"), false);
  });

  test("nobody may manage a peer or a superior, except the top rank", () => {
    for (const actor of ROLES) {
      if (actor === TOP_ROLE) continue;
      // Acting on an equal rank is refused — this is what stops two admins
      // demoting each other, and an admin editing another admin's account.
      assert.equal(canManageRank(actor, actor), false, `${actor} must not manage a peer`);
      for (const target of ROLES) {
        if (hasAtLeast(target, actor)) {
          assert.equal(canManageRank(actor, target), false, `${actor} must not manage ${target}`);
        }
      }
    }
  });

  test("everyone may manage strictly below their own rank", () => {
    assert.equal(canManageRank("owner", "administrator"), true);
    assert.equal(canManageRank("administrator", "moderator"), true);
    assert.equal(canManageRank("moderator", "member"), true);
    assert.equal(canManageRank("helper", "member"), true);
  });

  test("the top rank may act on its peers so the ladder has no dead end", () => {
    assert.equal(canManageRank(TOP_ROLE, TOP_ROLE), true);
    assert.equal(canGrantRank(TOP_ROLE, TOP_ROLE), true);
  });

  test("granting never exceeds the granter's own rank", () => {
    // The escalation that matters: an administrator handing out owner.
    assert.equal(canGrantRank("administrator", "owner"), false);
    assert.equal(canGrantRank("administrator", "administrator"), false);
    assert.equal(canGrantRank("administrator", "moderator"), true);
    assert.equal(canGrantRank("moderator", "administrator"), false);
    assert.equal(canGrantRank("member", "helper"), false);
  });
});

describe("safeNext (open-redirect guard)", () => {
  test("keeps ordinary same-origin paths", () => {
    assert.equal(safeNext("/dashboard"), "/dashboard");
    assert.equal(safeNext("/dashboard/settings?tab=profile"), "/dashboard/settings?tab=profile");
  });

  test("falls back to / for empty input", () => {
    assert.equal(safeNext(null), "/");
    assert.equal(safeNext(undefined), "/");
    assert.equal(safeNext(""), "/");
  });

  test("rejects absolute and protocol-relative URLs", () => {
    assert.equal(safeNext("https://evil.com"), "/");
    assert.equal(safeNext("//evil.com"), "/");
    assert.equal(safeNext("http://evil.com/path"), "/");
    assert.equal(safeNext("javascript:alert(1)"), "/");
  });

  test("rejects the backslash and whitespace bypasses a browser would resolve off-origin", () => {
    // Each of these is treated as "//evil.com" by a browser's URL parser.
    assert.equal(safeNext("/\\evil.com"), "/");
    assert.equal(safeNext("\\\\evil.com"), "/");
    assert.equal(safeNext("/\t/evil.com"), "/");
    assert.equal(safeNext("/\r\n/evil.com"), "/");
    assert.equal(safeNext("/\\/evil.com"), "/");
  });
});

describe("pickDiscordIdentity", () => {
  test("returns undefined when there is no Discord identity", () => {
    assert.equal(pickDiscordIdentity(undefined), undefined);
    assert.equal(pickDiscordIdentity(null), undefined);
    assert.equal(pickDiscordIdentity([{ provider: "google" }]), undefined);
  });

  test("picks the most recently used identity, not the first stored one", () => {
    // An account can hold two Discord identities. Array.find returns the oldest,
    // which showed users the account they had already switched away from.
    const picked = pickDiscordIdentity([
      { provider: "discord", updated_at: "2024-01-01T00:00:00Z", created_at: "2023-01-01T00:00:00Z" },
      { provider: "google", updated_at: "2026-01-01T00:00:00Z" },
      { provider: "discord", updated_at: "2026-06-01T00:00:00Z", created_at: "2025-01-01T00:00:00Z" },
    ]);
    assert.equal(picked?.updated_at, "2026-06-01T00:00:00Z");
  });

  test("falls back through last_sign_in_at and created_at when updated_at is absent", () => {
    const picked = pickDiscordIdentity([
      { provider: "discord", created_at: "2020-01-01T00:00:00Z" },
      { provider: "discord", last_sign_in_at: "2026-01-01T00:00:00Z" },
    ]);
    assert.equal(picked?.last_sign_in_at, "2026-01-01T00:00:00Z");
  });
});

describe("resolvePublicOrigin (canonical domain)", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalEnv = process.env.NODE_ENV;

  // NODE_ENV is typed as a readonly union by the Next/Node types but is an
  // ordinary writable string at runtime, hence the cast rather than
  // defineProperty (process.env rejects partial property descriptors).
  const env = process.env as Record<string, string | undefined>;

  function withEnv(nodeEnv: string, siteUrl: string | undefined, run: () => void) {
    env.NODE_ENV = nodeEnv;
    if (siteUrl === undefined) delete env.NEXT_PUBLIC_SITE_URL;
    else env.NEXT_PUBLIC_SITE_URL = siteUrl;
    try {
      run();
    } finally {
      env.NODE_ENV = originalEnv;
      if (originalUrl === undefined) delete env.NEXT_PUBLIC_SITE_URL;
      else env.NEXT_PUBLIC_SITE_URL = originalUrl;
    }
  }

  test("uses the apex when nothing is configured", () => {
    withEnv("production", undefined, () => {
      assert.equal(resolvePublicOrigin(), "https://mazora.us");
    });
  });

  test("accepts a correct production origin", () => {
    withEnv("production", "https://mazora.us", () => {
      assert.equal(resolvePublicOrigin(), "https://mazora.us");
    });
  });

  test("refuses the values that would de-index the site", () => {
    // Each of these has actually happened to someone: .env.example copied into
    // the dashboard, the deployment URL pasted in, or the scheme dropped.
    const poison = [
      "http://localhost:3000",
      "https://localhost:3000",
      "http://mazora.us",
      "https://www.mazora.us",
      "https://mazora-network.vercel.app",
      "not a url at all",
    ];
    for (const value of poison) {
      withEnv("production", value, () => {
        assert.equal(resolvePublicOrigin(), "https://mazora.us", `${value} must not become canonical`);
      });
    }
  });

  test("leaves development alone so localhost still works", () => {
    withEnv("development", "http://localhost:3000", () => {
      assert.equal(resolvePublicOrigin(), "http://localhost:3000");
    });
  });

  test("drops any path, query or trailing slash and keeps only the origin", () => {
    withEnv("production", "https://mazora.us/some/path?x=1", () => {
      assert.equal(resolvePublicOrigin(), "https://mazora.us");
    });
  });
});
