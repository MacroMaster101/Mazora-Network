import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadServerModule } from "./helpers/server-module";
import type * as Reauth from "@/lib/auth/reauth";
import type * as TwoFactorActions from "@/lib/actions/two-factor";
import type * as OwnerActions from "@/lib/actions/owner-confirmation";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The text from `start` up to the next `end` after it. */
function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from > -1, `${start} exists`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}

/** Values made inside the module sandbox have its prototypes: compare plain copies. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const userId = "00000000-0000-3000-8000-000000000001";
const sessionId = "00000000-0000-3000-8000-000000000002";

/* ------------------------------------------- "has a password" is not forgeable */

function reauth() {
  return loadServerModule<typeof Reauth>(new URL("../auth/reauth.ts", import.meta.url), {
    mocks: {
      "@supabase/supabase-js": { createClient() {} },
      "@/lib/supabase/config": { getSupabaseConfig: () => null },
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
      "@/lib/auth/two-factor-recovery": { redeemRecoveryCode: async () => ({ ok: false }) },
    },
  });
}

test("a member-written user_metadata flag never says the account has a password", () => {
  const { accountHasPassword } = reauth();
  const googleOnly = { identities: [{ provider: "google" }], app_metadata: {} };
  assert.equal(accountHasPassword({ ...googleOnly, user_metadata: { has_password: true } } as never), false);
  assert.equal(accountHasPassword(googleOnly), false);
  assert.doesNotMatch(between(read("../auth/reauth.ts"), "export function accountHasPassword", "\n}\n"), /user_metadata/);
  // The settings page asks the same question, and nothing writes the old flag any more.
  const panels = read("../../components/account/account-panels.tsx");
  assert.match(panels, /hasPassword = accountHasPassword\(data\.user\);/);
  assert.doesNotMatch(panels, /user_metadata\?\.has_password/);
  assert.doesNotMatch(read("../actions/auth.ts"), /data: \{ has_password: true \}/);
});

test("the email identity and the service-role flag still say yes, and an explicit no wins", () => {
  const { accountHasPassword } = reauth();
  assert.equal(accountHasPassword({ identities: [{ provider: "email" }] }), true);
  assert.equal(accountHasPassword({ identities: [{ provider: "discord" }], app_metadata: { has_password: true } }), true);
  assert.equal(accountHasPassword({ identities: [{ provider: "email" }], app_metadata: { has_password: false } }), false);
  assert.equal(accountHasPassword(null), false);
});

test("every password set records the flag through the service role", () => {
  const auth = read("../actions/auth.ts");
  const update = between(auth, "export async function updatePasswordAction", "\n}\n");
  assert.ok(update.indexOf("await markHasPassword(userData?.user?.id);") > update.indexOf("supabase.auth.updateUser("));
  const reset = between(auth, "export async function finishPasswordResetAction", "\n}\n");
  assert.ok(reset.indexOf("await markHasPassword(userData?.user?.id);") > reset.indexOf("supabase.auth.updateUser("));
});

test("migration 082 copies the old flag once, only onto accounts that really have a password", () => {
  const sql = read("../../../supabase/migrations/082_has_password_in_app_metadata.sql");
  assert.match(sql, /^begin;$/m);
  assert.match(sql, /^commit;$/m);
  assert.match(sql, /raw_user_meta_data->>'has_password' = 'true'/);
  // Never over an explicit false (an untrusted password removed) or a later true.
  assert.match(sql, /not \(coalesce\(raw_app_meta_data, '\{\}'::jsonb\) \? 'has_password'\)/);
  assert.match(sql, /coalesce\(encrypted_password, ''\) <> ''/);
  assert.match(sql, /raw_app_meta_data = coalesce\(raw_app_meta_data, '\{\}'::jsonb\) \|\| '\{"has_password": true\}'::jsonb/);
});

/* -------------------------------- recovery sign-in: removing factors is time-boxed */

function replacement(options: { fresh: boolean; ownerGrant: boolean }) {
  let removed = 0;
  let enrolled = 0;
  const issued: unknown[] = [];
  const actions = loadServerModule<typeof TwoFactorActions>(new URL("../actions/two-factor.ts", import.meta.url), {
    mocks: {
      "@/lib/supabase/admin": { getSupabaseAdmin: () => null },
      "@/lib/auth/account-deletion-proof": {},
      "@/lib/auth/email-two-factor": {},
      "@/lib/auth/email-two-factor-core": {},
      "@/lib/auth/email-two-factor-grant": { clearEmailTwoFactorGrant: async () => {} },
      "next/cache": { revalidatePath() {} },
      "next/navigation": { redirect() {} },
      "@/lib/auth": {
        getSession: async () => ({ username: "Steve_42", recoveredSignIn: true }),
        getSignInSessionId: async () => sessionId,
        getTwoFactorPendingUser: async () => null,
      },
      "@/lib/supabase/server": {
        createSupabaseServerClient: async () => ({
          auth: {
            getUser: async () => ({ data: { user: { id: userId } }, error: null }),
            mfa: {
              listFactors: async () => ({ data: { totp: [{ id: "old-factor" }], all: [] }, error: null }),
              unenroll: async () => ({ error: null }),
              enroll: async () => {
                enrolled += 1;
                // Supabase refuses a new factor at aal1 while a verified one exists.
                if (removed === 0) return { data: null, error: { code: "insufficient_aal" } };
                return { data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml,x", secret: "SECRET" } }, error: null };
              },
            },
          },
        }),
      },
      "@/lib/audit-log": { recordAudit: async () => undefined },
      "@/lib/security-alerts": { scheduleSecurityAlerts() {} },
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
      "@/lib/safe-redirect": { safeNext: (value: string) => value },
      "@/lib/auth/recovery-codes": { clearRecoveryCodes: async () => undefined, issueRecoveryCodes: async () => [] },
      "@/lib/auth/two-factor-recovery": {
        redeemRecoveryCode: async () => ({ ok: false }),
        removeAllFactors: async () => {
          removed += 1;
          return true;
        },
        removeFactor: async () => true,
      },
      "@/lib/auth/recovery-grant": {
        clearRecoveryGrant: async () => undefined,
        hasFreshRecoveryGrant: async () => options.fresh,
        issueRecoveryGrant: async () => true,
      },
      "@/lib/auth/replace-grant": { clearReplaceGrant: async () => undefined, hasReplaceGrant: async () => false, issueReplaceGrant: async () => true },
      "@/lib/auth/owner-grant": {
        hasOwnerGrant: async () => options.ownerGrant,
        issueOwnerGrant: async (subject: unknown) => {
          issued.push(subject);
          return true;
        },
      },
      "@/lib/auth/owner-confirmation": { ownerGrantSubject: async (id: string) => ({ userId: id, sessionId }) },
      "@/lib/auth/reauth": { confirmSecondStep: async () => null },
      "@/lib/data/account-status": { STATUS_UNREADABLE: "unreadable", accountStatusFor: async () => "active" },
      "@/lib/auth/login-identifier": { SUSPENDED_PATH: "/account-suspended" },
    },
  });
  return {
    start: () => actions.startTwoFactorEnrollmentAction(),
    removed: () => removed,
    enrolled: () => enrolled,
    issued: () => plain(issued),
  };
}

test("straight after a recovery sign-in, the lost phone is replaced without asking again", async () => {
  const flow = replacement({ fresh: true, ownerGrant: false });
  const result = await flow.start();
  assert.equal(result.ok, true);
  assert.equal(result.factorId, "new-factor");
  assert.equal(flow.removed(), 1);
  assert.deepEqual(flow.issued(), [{ userId, sessionId }], "the owner pass for the confirm step is still issued");
});

test("later in a recovered session, nothing is removed until the owner confirms it's them", async () => {
  const stale = replacement({ fresh: false, ownerGrant: false });
  assert.deepEqual(plain(await stale.start()), { ok: false, needsOwnerConfirm: true });
  assert.equal(stale.removed(), 0, "the authenticator stays on");
  assert.equal(stale.enrolled(), 0, "no QR code either");

  const confirmed = replacement({ fresh: false, ownerGrant: true });
  assert.equal((await confirmed.start()).ok, true);
  assert.equal(confirmed.removed(), 1);
});

test("the 'just recovered' marker lasts 15 minutes, has its own key and goes with the recovery pass", () => {
  const grant = read("../auth/recovery-grant.ts");
  assert.match(grant, /const FRESH_TTL_SECONDS = 15 \* 60;/);
  assert.match(grant, /deriveGrantKey\(secret, "mfa-recovery-sign-in-fresh"\)/);
  const issue = between(grant, "export async function issueRecoveryGrant", "\n}\n");
  assert.match(issue, /\.set\(FRESH_COOKIE, signSessionGrant\(subject, fk, nowSeconds\(\), FRESH_TTL_SECONDS\)/);
  const clear = between(grant, "export async function clearRecoveryGrant", "\n}\n");
  assert.match(clear, /jar\.delete\(COOKIE\);\s*jar\.delete\(FRESH_COOKIE\);/);
});

/* ------------------------- unconfirmed email: a way forward instead of a dead end */

function ownerActions(user: Record<string, unknown>) {
  const sent: unknown[] = [];
  const actions = loadServerModule<typeof OwnerActions>(new URL("../actions/owner-confirmation.ts", import.meta.url), {
    mocks: {
      "@/lib/auth": { getSession: async () => ({ role: "member" }) },
      "@/lib/supabase/server": {
        createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId, ...user } }, error: null }) } }),
      },
      "@/lib/auth/account-deletion-proof": {
        sendEmailProofCode: async (...args: unknown[]) => {
          sent.push(args);
          return true;
        },
      },
      "@/lib/auth/owner-grant": { hasOwnerGrant: async () => false, issueOwnerGrant: async () => true },
      "@/lib/auth/owner-confirmation": {
        confirmAccountOwner: async () => null,
        ownerGrantSubject: async (id: string) => ({ userId: id, sessionId }),
        ownerProofFor: async () => "email",
      },
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
    },
  });
  return { actions, sent };
}

test("an unconfirmed Google or Discord email is told how to get through, and no code is sent", async () => {
  const { actions, sent } = ownerActions({ email: "alex@example.com", email_confirmed_at: null });
  const result = plain(await actions.sendOwnerEmailCodeAction());
  assert.equal(result.ok, false);
  assert.equal(result.emailUnconfirmed, true);
  assert.match(result.message, /Forgot password/);
  assert.match(result.message, /Support/);
  assert.equal(sent.length, 0, "the confirmed-email requirement still holds");

  const status = plain(await actions.ownerConfirmationStatusAction());
  assert.deepEqual(status, { needed: true, proof: "email", emailUnconfirmed: true });
});

test("a confirmed email still gets its code, and the status says nothing extra", async () => {
  const { actions, sent } = ownerActions({ email: "alex@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" });
  assert.equal((await actions.sendOwnerEmailCodeAction()).ok, true);
  assert.deepEqual(plain(sent), [["account-change", { userId, sessionId }, "alex@example.com"]]);
  assert.deepEqual(plain(await actions.ownerConfirmationStatusAction()), { needed: true, proof: "email" });
});

test("the form shows Forgot password and Support instead of a send button that cannot work", () => {
  const form = read("../../components/account/owner-confirm.tsx");
  const help = between(form, '{proof === "email" && unconfirmed && (', '{proof === "email" && !unconfirmed && (');
  assert.match(help, /href="\/forgot-password"/);
  assert.match(help, /href="\/support"/);
  assert.match(form, /if \(result\.emailUnconfirmed\) \{\s*setUnconfirmed\(true\);/);
  assert.match(form, /emailUnconfirmed=\{state\.emailUnconfirmed\}/);
});

/* ------------------------------------------- sign-in throttle follows the account */

test("sign-in counts wrong passwords per account, after the username is resolved", () => {
  const login = between(read("../actions/auth.ts"), "export async function loginAction", "\n}\n");
  const perAddress = login.indexOf('throttleAuthAction("login", { limit: 40, windowMs: 15 * 60_000 });');
  const resolved = login.indexOf("const loginEmail = await resolveLoginEmail(parsed.data.identifier);");
  const peek = login.indexOf("const lockedOut = await loginLockedOut(lockoutIdentity);");
  const attempt = login.indexOf("supabase.auth.signInWithPassword(");
  assert.ok(perAddress > -1 && resolved > perAddress && peek > resolved && attempt > peek);
  // An unknown name keeps its own bucket, never the shared sentinel.
  assert.match(
    login.slice(resolved, peek),
    /const lockoutIdentity = loginEmail === UNRESOLVED_IDENTIFIER \? `unresolved:\$\{parsed\.data\.identifier\}` : loginEmail;/,
  );
  // Still one generic failure for a wrong password or an unknown account.
  assert.equal((login.match(/SIGN_IN_FAILED/g) ?? []).length, 1);
});

/* ----------------------------------------------------- signing out clears it all */

test("signing out clears the owner pass with the other passes", () => {
  const auth = read("../auth/index.ts");
  assert.match(read("../auth/owner-grant.ts"), /export async function clearOwnerGrant\(\): Promise<void> \{\s*\(await cookies\(\)\)\.delete\(COOKIE\);/);
  const destroy = between(auth, "export async function destroySession", "\n}\n");
  assert.match(destroy, /await clearOwnerGrant\(\);/);
  assert.match(destroy, /await clearRecoveryGrant\(\);/);
});
