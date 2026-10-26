import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { emailTwoFactorAllowedForSignIn, emailTwoFactorEnrollment, emailTwoFactorSubject } from "@/lib/auth/email-two-factor-core";
import * as grants from "@/lib/auth/reset-grant-core";
import { loadServerModule } from "./helpers/server-module";
import type * as Actions from "@/lib/actions/two-factor";
import type * as EmailGrant from "@/lib/auth/email-two-factor-grant";

const subject = { userId: "00000000-0000-3000-8000-000000000001", sessionId: "fake-sign-in-session" };
const version = "00000000-0000-3000-8000-000000000002";
const factor = { id: "00000000-0000-3000-8000-000000000003", factor_type: "totp" as const, status: "verified" as const, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const user = {
  id: subject.userId, email: "alex@example.com", email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { role: "member", mfa_email_fallback: { enabled: true, email: "alex@example.com", version } },
  factors: [factor], user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z",
} satisfies User;

test("email fallback is on by default with an authenticator, off only by a server-side opt-out", () => {
  assert.deepEqual(emailTwoFactorEnrollment(user), { email: "alex@example.com", version });
  // Nothing saved: on, with a fixed default version.
  assert.deepEqual(emailTwoFactorEnrollment({ ...user, app_metadata: {} }), { email: "alex@example.com", version: "default" });
  // An explicit opt-out turns it off; the same shape in user-editable metadata does not.
  const optedOut = { mfa_email_fallback: { enabled: false, version } };
  assert.equal(emailTwoFactorEnrollment({ ...user, app_metadata: optedOut }), null);
  assert.ok(emailTwoFactorEnrollment({ ...user, app_metadata: {}, user_metadata: optedOut } as User));
  // Codes only ever go to the account's current, confirmed inbox.
  assert.equal(emailTwoFactorEnrollment({ ...user, email: "steve@example.com" })?.email, "steve@example.com");
  assert.equal(emailTwoFactorEnrollment({ ...user, email_confirmed_at: undefined }), null);
  // Two-step verification itself must be on.
  assert.equal(emailTwoFactorEnrollment({ ...user, factors: [] }), null);
  assert.equal(emailTwoFactorSubject(user, ""), null);
});

function identity(provider: string, email?: string) {
  return {
    id: `fake-${provider}-identity`, identity_id: `fake-${provider}-identity`, user_id: subject.userId, provider,
    identity_data: email ? { email } : {}, created_at: "2026-01-01T00:00:00Z", last_sign_in_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  };
}

test("email codes finish only a password, provider or passkey sign-in, never an email-opened session", () => {
  const otherInbox = { ...user, identities: [identity("email", user.email), identity("discord", "alex.gamer@example.com")] };
  for (const amr of [["password"], ["oauth"], ["sso/saml"], ["passkey"]]) assert.equal(emailTwoFactorAllowedForSignIn(amr, otherInbox), true);
  // A password reset, magic link, invite or confirmation link was opened from the same inbox.
  for (const amr of [["recovery"], ["otp"], ["magiclink"], ["invite"], ["email/signup"], ["email_change"], ["password", "otp"], []]) {
    assert.equal(emailTwoFactorAllowedForSignIn(amr, otherInbox), false);
  }
});

test("a provider sign-in on the account's own address cannot finish with an email code", () => {
  // Signing in with the Google account that is the mailbox, then reading the code in it, is one credential twice.
  const sameInbox = { ...user, identities: [identity("google", "ALEX@example.com")] };
  assert.equal(emailTwoFactorAllowedForSignIn(["oauth"], sameInbox), false);
  // A provider that reports no address is treated as the same inbox.
  assert.equal(emailTwoFactorAllowedForSignIn(["oauth"], { ...user, identities: [identity("discord")] }), false);
  assert.equal(emailTwoFactorAllowedForSignIn(["oauth"], { ...user, email: undefined, identities: [] }), false);
  // A password or passkey sign-in on the same account still may.
  assert.equal(emailTwoFactorAllowedForSignIn(["password"], sameInbox), true);
  assert.equal(emailTwoFactorAllowedForSignIn(["passkey"], sameInbox), true);
});

test("a different session, email enrollment, or authenticator cannot reuse the same email pass", () => {
  const first = emailTwoFactorSubject(user, subject.sessionId)!;
  const key = grants.deriveGrantKey("fake-secret", "mfa-email-sign-in");
  const token = grants.signSessionGrant(first, key, 100, 600);
  assert.equal(grants.verifySessionGrant(token, first, key, 101), true);
  const changed = [
    emailTwoFactorSubject(user, "another-fake-session")!,
    emailTwoFactorSubject({ ...user, app_metadata: { mfa_email_fallback: { enabled: true, email: user.email, version: factor.id } } }, subject.sessionId)!,
    emailTwoFactorSubject({ ...user, factors: [{ ...factor, id: version }] as User["factors"] }, subject.sessionId)!,
  ];
  for (const other of changed) assert.equal(grants.verifySessionGrant(token, other, key, 101), false);
  assert.equal(grants.verifySessionGrant(token, first, key, 700), false);
  assert.equal(grants.verifySessionGrant(token, first, grants.deriveGrantKey("fake-secret", "mfa-recovery-sign-in"), 101), false);
});

test("email grants are secure cookies and cannot authorize owner confirmation or another sign-in", async () => {
  const saved = new Map<string, string>();
  let options: Record<string, unknown> = {};
  const grant = loadServerModule<typeof EmailGrant>(new URL("../auth/email-two-factor-grant.ts", import.meta.url), {
    env: { NODE_ENV: "production" },
    mocks: {
      "next/headers": { cookies: async () => ({
        set: (name: string, value: string, opts: Record<string, unknown>) => { saved.set(name, value); options = opts; },
        get: (name: string) => ({ value: saved.get(name) }), delete: (name: string) => saved.delete(name),
      }) },
      "@/lib/supabase/secret-key": { supabaseSecretKey: () => "fake-secret" },
      "./reset-grant-core": grants,
    },
  });
  assert.equal(await grant.issueEmailTwoFactorGrant(subject), true);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(await grant.hasEmailTwoFactorGrant(subject), true);
  assert.equal(await grant.hasEmailTwoFactorGrant({ ...subject, sessionId: "another-session" }), false);
  assert.equal(grants.verifySessionGrant(saved.get("mz_mfa_email"), subject, grants.deriveGrantKey("fake-secret", "account-owner-confirmed"), Math.floor(Date.now() / 1000)), false);
  await grant.clearEmailTwoFactorGrant();
  assert.equal(await grant.hasEmailTwoFactorGrant(subject), false);
});

function actionFixture({ optedOut = false, signedIn = true, secondStep = null as string | null, status = "active", consumed = true, sent = true, throttled = null as string | null, claim = "claimed", available = true, emailSession = false } = {}) {
  const account = optedOut ? { ...user, app_metadata: { role: "member", mfa_email_fallback: { enabled: false, version } } } : user;
  const events: string[] = [];
  const messages: { to: string; purpose: string }[] = [];
  let updated: Record<string, unknown> | null = null;
  const supabase = { auth: {
    getUser: async () => ({ data: { user: account } }),
    signOut: async () => { events.push("sign-out"); },
    mfa: { listFactors: async () => ({ data: { totp: [factor] } }) },
  } };
  const actions = loadServerModule<typeof Actions>(new URL("../actions/two-factor.ts", import.meta.url), {
    mocks: {
      "next/cache": { revalidatePath() {} },
      "next/navigation": { redirect: (to: string) => { throw new Error(`redirect:${to}`); } },
      "node:crypto": { randomUUID: () => version },
      "@/lib/auth": { getSession: async () => signedIn ? { username: "Alex_Builder" } : null, getSignInSessionId: async () => subject.sessionId, getTwoFactorPendingUser: async () => signedIn ? account : null, isEmailTwoFactorAllowed: async () => !emailSession },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => supabase },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ auth: { admin: { updateUserById: async (_id: string, data: Record<string, unknown>) => { events.push("update"); updated = data; return {}; } } } }) },
      "@/lib/audit-log": { recordAudit: async () => { events.push("audit"); } },
      "@/lib/security-alerts": { scheduleSecurityAlerts() {}, scheduleEmailCodeSignInAlert: () => { events.push("alert"); } },
      "@/lib/notifications-auto": { dispatchSignInNotifications: async () => { events.push("notices"); } },
      "@/lib/rate-limit": { throttleAuthAction: async () => { events.push("throttle"); return throttled; }, claimOnce: async () => claim },
      "@/lib/safe-redirect": { safeNext: (value?: string) => value?.startsWith("/") && !value.startsWith("//") ? value : "/" },
      "@/lib/auth/account-deletion-proof": {
        sendEmailProofCode: async (purpose: string, _subject: unknown, to: string) => { messages.push({ to, purpose }); return sent; },
        consumeEmailProofCode: async () => { events.push("consume"); return consumed; },
      },
      "@/lib/auth/email-two-factor": { emailTwoFactorAvailable: () => available },
      "@/lib/auth/email-two-factor-core": { emailTwoFactorSubject },
      "@/lib/auth/email-two-factor-grant": { clearEmailTwoFactorGrant: async () => { events.push("clear-email"); }, issueEmailTwoFactorGrant: async () => { events.push("grant"); return true; } },
      "@/lib/auth/recovery-codes": { clearRecoveryCodes: async () => {} },
      "@/lib/auth/two-factor-recovery": { removeAllFactors: async () => { events.push("remove-factors"); return true; } },
      "@/lib/auth/recovery-grant": { issueRecoveryGrant: async () => true, clearRecoveryGrant: async () => {} },
      "@/lib/auth/replace-grant": {}, "@/lib/auth/owner-grant": {}, "@/lib/auth/owner-confirmation": {},
      "@/lib/auth/reauth": { confirmSecondStep: async () => { events.push("second-step"); return secondStep; } },
      "@/lib/data/account-status": { STATUS_UNREADABLE: "unreadable", accountStatusFor: async () => status },
      "@/lib/auth/login-identifier": { SUSPENDED_PATH: "/account-suspended" },
    },
  });
  const form = new FormData();
  form.set("code", "123456"); form.set("next", "/dashboard"); form.set("emailFallback", "enable");
  return { actions, form, events, messages, updated: () => updated };
}

test("email delivery needs a pending account that has not opted out, uses its own inbox, and respects resend limits", async () => {
  for (const options of [{ signedIn: false }, { optedOut: true }, { available: false }, { emailSession: true }, { throttled: "Too many attempts" }, { claim: "duplicate" }, { claim: "unavailable" }]) {
    const f = actionFixture(options);
    assert.equal((await f.actions.requestTwoFactorEmailCodeAction({ ok: false }, f.form)).ok, false);
    assert.equal(f.messages.length, 0);
  }
  const f = actionFixture();
  f.form.set("email", "steve@example.com");
  assert.equal((await f.actions.requestTwoFactorEmailCodeAction({ ok: false }, f.form)).ok, true);
  assert.equal(f.messages[0].to, "alex@example.com");
  assert.equal(f.messages[0].purpose, "two-factor-sign-in");
  // A click turned away by the one-minute wait does not use up the send limit.
  const waiting = actionFixture({ claim: "duplicate" });
  await waiting.actions.requestTwoFactorEmailCodeAction({ ok: false }, waiting.form);
  assert.equal(waiting.events.includes("throttle"), false);
  const failure = actionFixture({ sent: false });
  assert.equal((await failure.actions.requestTwoFactorEmailCodeAction({ ok: false }, failure.form)).ok, false);
});

test("email codes never grant a sign-in on a wrong code, throttling, an opt-out, or a suspended account", async () => {
  for (const options of [{ signedIn: false }, { optedOut: true }, { emailSession: true }, { consumed: false }, { throttled: "Too many attempts" }]) {
    const f = actionFixture(options);
    assert.equal((await f.actions.verifyTwoFactorEmailCodeAction({ ok: false }, f.form)).ok, false);
    assert.equal(f.events.includes("grant"), false);
    assert.equal(f.events.includes("alert"), false);
  }
  for (const status of ["suspended", "unreadable"]) {
    const f = actionFixture({ status });
    await assert.rejects(f.actions.verifyTwoFactorEmailCodeAction({ ok: false }, f.form), /redirect:/);
    assert.equal(f.events.includes("grant"), false);
    assert.equal(f.events.includes("sign-out"), true);
  }
  const f = actionFixture();
  await assert.rejects(f.actions.verifyTwoFactorEmailCodeAction({ ok: false }, f.form), /redirect:\/dashboard/);
  assert.ok(f.events.indexOf("consume") < f.events.indexOf("grant"));
  // The owner is told about every sign-in an email code completes.
  assert.ok(f.events.indexOf("grant") < f.events.indexOf("alert"));
  // The sign-in notices go out once the second step is done, not at the password step.
  assert.ok(f.events.indexOf("grant") < f.events.indexOf("notices"));
});

test("turning email codes off or on needs fresh authenticator or recovery proof and preserves role metadata", async () => {
  const rejected = actionFixture({ secondStep: "Enter an authenticator code" });
  assert.equal((await rejected.actions.setTwoFactorEmailFallbackAction(rejected.form)).ok, false);
  assert.equal(rejected.updated(), null);
  const f = actionFixture();
  assert.equal((await f.actions.setTwoFactorEmailFallbackAction(f.form)).ok, true);
  assert.ok(f.events.indexOf("second-step") < f.events.indexOf("update"));
  const metadata = f.updated()?.app_metadata as Record<string, unknown>;
  assert.equal(metadata.role, "member");
  assert.equal((metadata.mfa_email_fallback as Record<string, unknown>).email, "alex@example.com");
  f.form.set("emailFallback", "disable");
  assert.equal((await f.actions.setTwoFactorEmailFallbackAction(f.form)).ok, true);
  // Off is saved explicitly: removing the setting would turn the default back on.
  assert.equal(JSON.stringify((f.updated()?.app_metadata as Record<string, unknown>).mfa_email_fallback), JSON.stringify({ enabled: false, version }));
});

test("turning two-step off keeps an explicit email-code opt-out, so turning it back on does not re-enable email", async () => {
  const optedOut = actionFixture({ optedOut: true });
  assert.equal((await optedOut.actions.disableTwoFactorAction(optedOut.form)).ok, true);
  assert.equal(optedOut.events.includes("update"), false);
  assert.ok(optedOut.events.includes("remove-factors"));
  const on = actionFixture();
  assert.equal((await on.actions.disableTwoFactorAction(on.form)).ok, true);
  assert.equal((on.updated()?.app_metadata as Record<string, unknown>).mfa_email_fallback, null);
});
