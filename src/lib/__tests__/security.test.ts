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
import { readFileSync } from "node:fs";

import { canGrantRank, canManageRank, hasAtLeast, isAdmin, isStaff, ROLES, TOP_ROLE } from "@/lib/auth/roles";
import { pickDiscordIdentity } from "@/lib/auth/discord-identity";
import { isMinecraftAvatarUrl } from "@/lib/avatar-source";
import { safeNext } from "@/lib/safe-redirect";
import { resolvePublicOrigin } from "@/lib/site";
import { isSupabaseStorageObjectUrl } from "@/lib/storage-url";
import { visibleAdminNav, ALL_ADMIN_NAV_ACCESS, type AdminNavAccess } from "@/lib/admin-nav";

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

describe("isMinecraftAvatarUrl", () => {
  test("accepts Minecraft head URLs used by public staff cards", () => {
    assert.equal(isMinecraftAvatarUrl("https://mc-heads.net/avatar/JesteR_X_44/256"), true);
    assert.equal(
      isMinecraftAvatarUrl("https://project.supabase.co/storage/v1/object/public/profile-avatars/id/skin-head-1.png"),
      true,
    );
  });

  test("rejects legacy usernames, relative paths, and unrelated provider photos", () => {
    assert.equal(isMinecraftAvatarUrl("LilyLuvv"), false);
    assert.equal(isMinecraftAvatarUrl("/avatar/LilyLuvv"), false);
    assert.equal(isMinecraftAvatarUrl("https://lh3.googleusercontent.com/avatar.png"), false);
  });
});

describe("isSupabaseStorageObjectUrl", () => {
  const project = "https://project.supabase.co";

  test("accepts object URLs on the configured project", () => {
    assert.equal(
      isSupabaseStorageObjectUrl(
        "https://project.supabase.co/storage/v1/object/public/gallery/image.webp",
        project,
      ),
      true,
    );
  });

  test("rejects lookalike hosts and non-storage project endpoints", () => {
    assert.equal(
      isSupabaseStorageObjectUrl(
        "https://project.supabase.co.evil.example/storage/v1/object/public/gallery/image.webp",
        project,
      ),
      false,
    );
    assert.equal(isSupabaseStorageObjectUrl("https://project.supabase.co/auth/v1/user", project), false);
    assert.equal(isSupabaseStorageObjectUrl("not a url", project), false);
  });
});

describe("permission-aware admin navigation", () => {
  const denied: AdminNavAccess = {
    users: false,
    minecraft: false,
    suggestions: false,
    staff: false,
    play: false,
    news: false,
    events: false,
    gameModes: false,
    rules: false,
    gallery: false,
    support: false,
    appeals: false,
    store: false,
    orders: false,
    voting: false,
    notifications: false,
    bot: false,
  };

  function labels(role: "helper" | "moderator" | "senior_moderator", access: AdminNavAccess) {
    return visibleAdminNav(role, access).flatMap((group) => group.items.map((item) => item.label));
  }

  test("shows assigned modules even when their default rank is higher", () => {
    const access = { ...denied, suggestions: true, appeals: true, events: true };
    assert.deepEqual(
      labels("helper", access),
      // Suggestions sits last in the Support group (after Support Pages and
      // Application Forms), and Support follows Content — so it trails "Events"
      // and "Application Forms" here. Order is section order, not permission order.
      ["Control room", "Events", "Application Forms", "Suggestions"],
    );
  });

  test("does not show a module merely because an old static rank allowed it", () => {
    const moderatorLabels = labels("moderator", { ...denied, suggestions: true });
    assert.equal(moderatorLabels.includes("Minecraft Players"), false);
    assert.equal(moderatorLabels.includes("Suggestions"), true);
  });

  test("the bot console is hidden when access is withheld", () => {
    const access = { ...ALL_ADMIN_NAV_ACCESS, bot: false } as AdminNavAccess;
    const hrefs = visibleAdminNav("owner", access).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    assert.ok(!hrefs.includes("/admin/mazora-bot"));
  });

  test("the bot console is shown to an owner who has access", () => {
    const hrefs = visibleAdminNav("owner", ALL_ADMIN_NAV_ACCESS).flatMap((group) =>
      group.items.map((item) => item.href),
    );
    assert.ok(hrefs.includes("/admin/mazora-bot"));
  });
});

describe("permission-aware admin mutations", () => {
  const guardedActions = [
    ["voting-admin.ts", "canManageVoting"],
    ["rules.ts", "canManageRules"],
    ["faqs.ts", "canManagePlay"],
    ["support-settings.ts", "canManageSupport"],
    ["store-admin.ts", "canManageStore"],
    ["store-settings.ts", "canManageStore"],
    ["creator-codes.ts", "canManageStore"],
    ["orders-admin.ts", "canManageOrders"],
    ["staff-notices.ts", "MAZORA_BOT_PERMISSION_KEY"],
  ] as const;

  test("write actions enforce the same configurable module permissions as their pages", () => {
    for (const [file, guard] of guardedActions) {
      const source = readFileSync(new URL(`../actions/${file}`, import.meta.url), "utf8");
      assert.match(source, new RegExp(`\\b${guard}\\b`), `${file} must use ${guard}`);
      assert.doesNotMatch(
        source,
        /hasAtLeast\(session\.role,\s*["']administrator["']\)|requireRole\(["']administrator["']/,
        `${file} must not bypass its configurable module permission with a fixed administrator check`,
      );
    }
  });

  test("order decisions and deletion keep their audit write in a transaction", () => {
    const source = readFileSync(new URL("../actions/orders-admin.ts", import.meta.url), "utf8");
    assert.equal(
      source.match(/db\.transaction\(async \(tx\) =>/g)?.length,
      2,
      "both order mutations must be atomic with their audit entries",
    );
    assert.doesNotMatch(source, /await db\.(update|delete)\(schema\.orders\)/);
  });
});

describe("account deletion privacy", () => {
  test("admin deletion runs shared cleanup and does not retain deleted-user identifiers in its audit entry", () => {
    const source = readFileSync(new URL("../actions/user-admin.ts", import.meta.url), "utf8");
    const deletion = source.slice(source.indexOf("export async function deleteUserAction"), source.indexOf("export async function adminReleaseMinecraftUsernameAction"));

    assert.match(deletion, /cleanupAccountOwnedData\(userId\)/);
    assert.match(deletion, /targetId:\s*null/);
    assert.doesNotMatch(deletion, /metadata:\s*\{[\s\S]*?\b(email|username):/);
  });

  test("the database migration enforces complete account deletion and anonymized retention", () => {
    const migration = readFileSync(
      new URL("../../../supabase/migrations/032_restore_auth_user_foreign_keys.sql", import.meta.url),
      "utf8",
    );

    for (const constraint of [
      "profiles_user_id_fkey",
      "minecraft_accounts_user_id_fkey",
      "suggestions_user_id_fkey",
      "suggestion_votes_user_id_fkey",
      "vote_history_user_id_fkey",
      "gallery_images_author_id_fkey",
      "gallery_likes_user_id_fkey",
    ]) {
      assert.match(
        migration,
        new RegExp(`constraint ${constraint}[^;]*on delete cascade`, "i"),
        `${constraint} must delete account-owned data`,
      );
    }

    for (const constraint of [
      "news_articles_author_id_fkey",
      "orders_user_id_fkey",
      "audit_logs_actor_id_fkey",
      "creator_codes_created_by_fkey",
    ]) {
      assert.match(
        migration,
        new RegExp(`constraint ${constraint}[^;]*on delete set null`, "i"),
        `${constraint} must anonymize retained history`,
      );
    }

    assert.match(migration, /before delete on auth\.users/i);
    assert.match(migration, /set[\s\S]*discord_id = null[\s\S]*minecraft_username = null[\s\S]*notes = null/i);
  });

  test("the account deletion trigger is not executable through Data API roles", () => {
    const migration = readFileSync(
      new URL("../../../supabase/migrations/033_restrict_account_delete_trigger.sql", import.meta.url),
      "utf8",
    );

    assert.match(
      migration,
      /revoke execute\s+on function public\.prepare_account_delete\(\)\s+from anon, authenticated;/i,
    );
  });
});

describe("email verification lifecycle", () => {
  test("unconfirmed profiles stay pending until auth confirms the email", () => {
    const enumMigration = readFileSync(
      new URL("../../../supabase/migrations/034_add_pending_account_status.sql", import.meta.url),
      "utf8",
    );
    const lifecycleMigration = readFileSync(
      new URL("../../../supabase/migrations/035_activate_profiles_after_email_verification.sql", import.meta.url),
      "utf8",
    );

    assert.match(enumMigration, /add value if not exists 'pending'/i);
    assert.match(lifecycleMigration, /new\.email_confirmed_at is null then 'pending'/i);
    assert.match(lifecycleMigration, /after update of email_confirmed_at on auth\.users/i);
    assert.match(lifecycleMigration, /account_status = 'pending'[\s\S]*email_confirmed_at is null/i);
    assert.match(lifecycleMigration, /and account_status = 'pending'/i);
  });

  test("the application denies pending sessions and securely resumes an unfinished signup", () => {
    const sessionSource = readFileSync(new URL("../auth/index.ts", import.meta.url), "utf8");
    const actionSource = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
    const registerSource = actionSource.slice(
      actionSource.indexOf("export async function registerAction"),
      actionSource.indexOf("export async function oauthAction"),
    );

    assert.match(sessionSource, /hasEmailIdentity && !data\.user\.email_confirmed_at/);
    assert.match(sessionSource, /profile\.account_status !== "active"/);
    assert.match(registerSource, /identity: parsed\.data\.email/);
    assert.match(registerSource, /pendingRegistrationCredentialsMatch\(parsed\.data\.email, parsed\.data\.password\)/);
    assert.match(actionSource, /sameEmail && !owner\.user\?\.email_confirmed_at/);
    assert.match(actionSource, /linkVerifiedRegistration\(supabase\)/);
    assert.ok(
      registerSource.indexOf("pendingRegistrationCredentialsMatch") < registerSource.indexOf("getUserById"),
      "the pending password must be proved before reading the username owner's email",
    );
    assert.doesNotMatch(
      registerSource,
      /auth\.resend\(/,
      "registration collisions must not trigger unsolicited confirmation email",
    );
    assert.doesNotMatch(
      registerSource,
      /linkMinecraftIgn\(/,
      "an unverified signup must not receive an active Minecraft link",
    );
  });

  test("public auth writes are throttled and identity limits survive IP rotation", () => {
    const actionSource = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
    const limiterSource = readFileSync(new URL("../rate-limit.ts", import.meta.url), "utf8");

    for (const scope of [
      "login",
      "register",
      "oauth-start:",
      "oauth-link",
      "confirm-link",
      "confirm-verify",
      "resend-confirmation",
      "reset-request",
      "reset-verify",
      "reset-finish",
      "password-update",
      "discord-switch",
      "discord-account-switch",
      "discord-unlink",
    ]) {
      assert.ok(
        actionSource.includes(`throttleAuthAction("${scope}`) || actionSource.includes(`throttleAuthAction(\`${scope}`),
        `${scope} must have an application-level rate limit`,
      );
    }

    assert.match(limiterSource, /actionClientKey\(`\$\{scope\}:ip`\)/);
    assert.match(limiterSource, /\$\{scope\}:identity:\$\{hashed\(identity\.trim\(\)\.toLowerCase\(\)\)\}/);
    assert.match(limiterSource, /Promise\.all\(checks\)/);
  });
});
