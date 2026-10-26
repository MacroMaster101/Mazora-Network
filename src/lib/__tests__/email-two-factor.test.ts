import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { emailTwoFactorEnrollment, emailTwoFactorSubject } from "@/lib/auth/email-two-factor-core";
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

test("email fallback is opt-in, ignores user metadata, and requires a confirmed inbox and authenticator", () => {
  assert.ok(emailTwoFactorEnrollment(user));
  assert.equal(emailTwoFactorEnrollment({ ...user, app_metadata: {} }), null);
  assert.equal(emailTwoFactorEnrollment({ ...user, app_metadata: {}, user_metadata: user.app_metadata } as User), null);
  assert.equal(emailTwoFactorEnrollment({ ...user, email_confirmed_at: undefined }), null);
  assert.equal(emailTwoFactorEnrollment({ ...user, factors: [] }), null);
  assert.equal(emailTwoFactorEnrollment({ ...user, email: "steve@example.com" }), null);
  assert.equal(emailTwoFactorSubject(user, ""), null);
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

function actionFixture({ optedIn = true, signedIn = true, secondStep = null as string | null, status = "active", consumed = true, sent = true, throttled = null as string | null, claim = "claimed", available = true } = {}) {
  const account = optedIn ? user : { ...user, app_metadata: { role: "member" } };
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
      "@/lib/auth": { getSession: async () => signedIn ? { username: "Alex_Builder" } : null, getSignInSessionId: async () => subject.sessionId, getTwoFactorPendingUser: async () => signedIn ? account : null },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => supabase },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ auth: { admin: { updateUserById: async (_id: string, data: Record<string, unknown>) => { events.push("update"); updated = data; return {}; } } } }) },
      "@/lib/audit-log": { recordAudit: async () => { events.push("audit"); } },
      "@/lib/security-alerts": { scheduleSecurityAlerts() {} },
      "@/lib/rate-limit": { throttleAuthAction: async () => throttled, claimOnce: async () => claim },
      "@/lib/safe-redirect": { safeNext: (value?: string) => value?.startsWith("/") && !value.startsWith("//") ? value : "/" },
      "@/lib/auth/account-deletion-proof": {
        sendEmailProofCode: async (purpose: string, _subject: unknown, to: string) => { messages.push({ to, purpose }); return sent; },
        consumeEmailProofCode: async () => { events.push("consume"); return consumed; },
      },
      "@/lib/auth/email-two-factor": { emailTwoFactorAvailable: () => available },
      "@/lib/auth/email-two-factor-core": { emailTwoFactorSubject },
      "@/lib/auth/email-two-factor-grant": { clearEmailTwoFactorGrant: async () => { events.push("clear-email"); }, issueEmailTwoFactorGrant: async () => { events.push("grant"); return true; } },
      "@/lib/auth/recovery-codes": {}, "@/lib/auth/two-factor-recovery": {},
      "@/lib/auth/recovery-grant": { issueRecoveryGrant: async () => true },
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

test("email delivery needs a pending opted-in account, uses its own inbox, and respects resend limits", async () => {
  for (const options of [{ signedIn: false }, { optedIn: false }, { available: false }, { throttled: "Too many attempts" }, { claim: "duplicate" }, { claim: "unavailable" }]) {
    const f = actionFixture(options);
    assert.equal((await f.actions.requestTwoFactorEmailCodeAction({ ok: false }, f.form)).ok, false);
    assert.equal(f.messages.length, 0);
  }
  const f = actionFixture();
  f.form.set("email", "steve@example.com");
  assert.equal((await f.actions.requestTwoFactorEmailCodeAction({ ok: false }, f.form)).ok, true);
  assert.equal(f.messages[0].to, "alex@example.com");
  assert.equal(f.messages[0].purpose, "two-factor-sign-in");
  const failure = actionFixture({ sent: false });
  assert.equal((await failure.actions.requestTwoFactorEmailCodeAction({ ok: false }, failure.form)).ok, false);
});

test("email codes never grant a sign-in on a wrong code, throttling, missing opt-in, or suspended account", async () => {
  for (const options of [{ signedIn: false }, { optedIn: false }, { consumed: false }, { throttled: "Too many attempts" }]) {
    const f = actionFixture(options);
    assert.equal((await f.actions.verifyTwoFactorEmailCodeAction({ ok: false }, f.form)).ok, false);
    assert.equal(f.events.includes("grant"), false);
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
});

test("enabling email fallback needs fresh authenticator or recovery proof and preserves role metadata", async () => {
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
  assert.equal((f.updated()?.app_metadata as Record<string, unknown>).mfa_email_fallback, null);
});
