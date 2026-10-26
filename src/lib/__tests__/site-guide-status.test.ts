import assert from "node:assert/strict";
import test from "node:test";
import { loadServerModule } from "./helpers/server-module";
import type * as Actions from "@/lib/actions/site-guide";

function load({ signedIn = true, twoFactor = false, passkeysEnabled = true, passkeys = [] as unknown[] | null, emailCodes = true } = {}) {
  return loadServerModule<typeof Actions>(new URL("../actions/site-guide.ts", import.meta.url), {
    mocks: {
      "@/lib/auth": {
        getSession: async () => signedIn ? { username: "Steve_42", twoFactorEnabled: twoFactor } : null,
        getSessionUserId: async () => signedIn ? "00000000-0000-3000-8000-000000000001" : null,
        getDiscordIdentity: async () => null,
      },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => ({
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { minecraft_username: "Steve_42" } }) }) }) }),
      }) },
      "@/lib/supabase/config": { isSupabaseConfigured: () => true },
      "@/lib/auth/email-two-factor": { emailTwoFactorAvailable: () => emailCodes },
      "@/lib/data/passkeys": { getMyPasskeys: async () => passkeys },
      "@/lib/data/site-settings": { getSiteGeneralSettings: async () => ({ passkeysEnabled }) },
    },
  });
}

test("the guide status reports two-step, email codes and passkeys from the member's own session", async () => {
  const status = await load({ twoFactor: true, passkeys: [{ id: "fake-passkey" }] }).getSiteGuideStatus();
  assert.equal(JSON.stringify(status), JSON.stringify({ ign: "Steve_42", discord: null, twoFactor: true, emailCodes: true, passkeys: true }));
  const fresh = await load({ emailCodes: false }).getSiteGuideStatus();
  assert.equal(fresh.twoFactor, false);
  assert.equal(fresh.emailCodes, false);
  assert.equal(fresh.passkeys, false);
});

test("passkeys are left out of the guide while they are switched off site-wide", async () => {
  assert.equal((await load({ passkeysEnabled: false, passkeys: [{ id: "fake-passkey" }] }).getSiteGuideStatus()).passkeys, null);
});

test("a signed-out request gets an empty guide status", async () => {
  const status = await load({ signedIn: false, twoFactor: true }).getSiteGuideStatus();
  assert.equal(JSON.stringify(status), JSON.stringify({ ign: null, discord: null, twoFactor: false, emailCodes: false, passkeys: null }));
});
