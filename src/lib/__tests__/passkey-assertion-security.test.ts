import assert from "node:assert/strict";
import test from "node:test";
import { passkeyAssertionSchema } from "@/lib/passkeys/assertion-schema";
import { assertionUserVerified } from "@/lib/passkeys/user-verified";
import { loadServerModule } from "./helpers/server-module";
import type * as Actions from "@/lib/actions/passkeys";

function assertion(flags = 0x05) {
  const data = Buffer.alloc(37);
  data[32] = flags;
  return {
    id: "ZmFrZS1jcmVkZW50aWFs",
    rawId: "ZmFrZS1jcmVkZW50aWFs",
    type: "public-key",
    authenticatorAttachment: "cross-platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: Buffer.from('{"origin":"https://example.com"}').toString("base64url"),
      authenticatorData: data.toString("base64url"),
      signature: "ZmFrZS1zaWduYXR1cmU",
      userHandle: null,
    },
  };
}

/** Only the provider verification and request infrastructure are mocked. */
function signInFixture(providerAccepts = true) {
  const providerInputs: unknown[] = [];
  const flagInputs: unknown[] = [];
  let grants = 0;
  const userId = "00000000-0000-3000-8000-000000000001";
  const sessionId = "00000000-0000-3000-8000-000000000002";
  const actions = loadServerModule<typeof Actions>(new URL("../actions/passkeys.ts", import.meta.url), {
    mocks: {
      "next/cache": {},
      "next/headers": { cookies: async () => ({ set() {}, delete() {} }) },
      "@/lib/auth": {
        getSession: async () => grants ? { role: "member" } : null,
        getSessionUserId: async () => userId,
        isTwoFactorPending: async () => !grants,
        landingPathFor: () => "/dashboard",
        twoFactorPath: () => "/two-factor",
      },
      "@/lib/auth/passkey-grant": {},
      "@/lib/auth/passkey-signin-grant": { issuePasskeySignInGrant: async () => { grants++; return true; } },
      "@/lib/passkeys/assertion-schema": { passkeyAssertionSchema },
      "@/lib/passkeys/user-verified": { assertionUserVerified: (credential: unknown) => { flagInputs.push(credential); return assertionUserVerified(credential); } },
      "@/lib/supabase/config": { isSupabaseConfigured: () => true },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { passkey: {
        verifyAuthentication: async ({ credential }: { credential: unknown }) => {
          providerInputs.push(credential);
          return providerAccepts
            ? { data: { user: { id: userId, factors: [{ status: "verified" }] }, session: { access_token: `fake.${Buffer.from(JSON.stringify({ session_id: sessionId })).toString("base64url")}.fake` } }, error: null }
            : { data: null, error: { code: "webauthn_verification_failed" } };
        },
      } } }) },
      "@/lib/data/site-settings": { getSiteGeneralSettings: async () => ({ passkeysEnabled: true }) },
      "@/lib/data/account-status": { STATUS_UNREADABLE: "unreadable", accountStatusFor: async () => "active" },
      "@/lib/auth/login-identifier": {},
      "@/lib/auth/signup-trust": {},
      "@/lib/notifications-auto": { dispatchSignInNotifications: async () => {} },
      "@/lib/security-alerts": { scheduleSecurityAlerts: () => {} },
      "@/lib/auth/account-deletion-proof": {},
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
      "@/lib/safe-redirect": { safeNext: () => "/dashboard" },
      "@/lib/supabase/session-cookie": { SESSION_ONLY_COOKIE: "fake-session-marker", sessionOnlyMarkerOptions: () => ({}) },
      "@/lib/auth/reauth": {},
      "@/lib/audit-log": {},
    },
  });
  return { actions, providerInputs, flagInputs, grants: () => grants };
}

test("case-colliding assertion fields are rejected before provider verification or a second-step grant", async () => {
  for (const name of ["AuthenticatorData", "AUTHENTICATORDATA", "authenticatordata"]) {
    for (const alternateFirst of [false, true]) {
      const credential = assertion();
      const alternate = { [name]: assertion(0x01).response.authenticatorData };
      credential.response = (alternateFirst ? { ...alternate, ...credential.response } : { ...credential.response, ...alternate });
      const fixture = signInFixture();
      const result = await fixture.actions.finishPasskeySignInAction({ challengeId: "fake-challenge", credential });
      assert.equal(result.ok, false);
      assert.equal(fixture.providerInputs.length, 0);
      assert.equal(fixture.grants(), 0);
    }
  }
  for (const extra of [{ Response: assertion(0x01).response }, { RawId: "ZmFrZQ" }, { unexpected: true }]) {
    const fixture = signInFixture();
    assert.equal((await fixture.actions.finishPasskeySignInAction({ challengeId: "fake-challenge", credential: { ...assertion(), ...extra } })).ok, false);
    assert.equal(fixture.providerInputs.length, 0);
  }
});

test("the UV check reads the exact parsed object sent to the provider after verification", async () => {
  const fixture = signInFixture();
  const credential = assertion();
  const result = await fixture.actions.finishPasskeySignInAction({ challengeId: "fake-challenge", credential });
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.redirectTo === "/dashboard");
  assert.equal(fixture.grants(), 1);
  assert.notEqual(fixture.providerInputs[0], credential, "the raw input is not forwarded");
  assert.equal(fixture.providerInputs[0], fixture.flagInputs[0], "one parsed assertion for both checks");
});

test("presence-only keys still owe the authenticator code, and provider refusal never issues a grant", async () => {
  const presence = signInFixture();
  const result = await presence.actions.finishPasskeySignInAction({ challengeId: "fake-challenge", credential: assertion(0x01) });
  assert.ok(result.ok && result.redirectTo === "/two-factor");
  assert.equal(presence.grants(), 0);
  const refused = signInFixture(false);
  assert.equal((await refused.actions.finishPasskeySignInAction({ challengeId: "fake-challenge", credential: assertion() })).ok, false);
  assert.equal(refused.flagInputs.length, 0);
  assert.equal(refused.grants(), 0);
});

test("strict assertions accept browser optional fields and refuse malformed or oversized credentials", () => {
  for (const userHandle of [null, undefined, "", "ZmFrZS11c2Vy"]) {
    const credential = assertion();
    assert.equal(passkeyAssertionSchema.safeParse({ ...credential, authenticatorAttachment: null, response: { ...credential.response, userHandle } }).success, true);
  }
  const credential = assertion();
  assert.equal(passkeyAssertionSchema.safeParse({ ...credential, type: "other" }).success, false);
  assert.equal(passkeyAssertionSchema.safeParse({ ...credential, response: { ...credential.response, signature: "" } }).success, false);
  assert.equal(passkeyAssertionSchema.safeParse({ ...credential, clientExtensionResults: { fake: "a".repeat(20_000) } }).success, false);
  assert.equal(passkeyAssertionSchema.safeParse({ ...credential, response: { ...credential.response, attestationObject: "ZmFrZQ" } }).success, false);
});
