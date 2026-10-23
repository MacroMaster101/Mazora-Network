import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as ownerProofKindModule from "@/lib/auth/owner-proof-kind";
import { ownerProofKind } from "@/lib/auth/owner-proof-kind";
import { loadServerModule } from "./helpers/server-module";
import type * as OwnerConfirmation from "@/lib/auth/owner-confirmation";
import type * as TwoFactorActions from "@/lib/actions/two-factor";
import type * as OwnerActions from "@/lib/actions/owner-confirmation";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The text of one exported function, from its signature to the next export. */
function body(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start > -1, `${name} exists`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

/** Values made inside the module sandbox have its prototypes: compare plain copies. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const userId = "00000000-0000-3000-8000-000000000001";
const sessionId = "00000000-0000-3000-8000-000000000002";

/* ------------------------------------------------------------ what is asked */

test("'confirm it's you' asks for the authenticator, then the password, then an emailed code", () => {
  assert.equal(ownerProofKind({ hasAuthenticator: true, hasPassword: true }), "code");
  assert.equal(ownerProofKind({ hasAuthenticator: true, hasPassword: false }), "code");
  assert.equal(ownerProofKind({ hasAuthenticator: false, hasPassword: true }), "password");
  assert.equal(ownerProofKind({ hasAuthenticator: false, hasPassword: false }), "email");
});

/** confirmAccountOwner with every external check replaced by a recorder. */
function ownerCheck(account: { totp: number; hasPassword: boolean; passwordOk?: boolean; emailCodeOk?: boolean }) {
  const calls: string[] = [];
  const emailCodes: unknown[] = [];
  const owner = loadServerModule<typeof OwnerConfirmation>(new URL("../auth/owner-confirmation.ts", import.meta.url), {
    mocks: {
      "@/lib/auth": { getSignInSessionId: async () => sessionId },
      "@/lib/auth/owner-proof-kind": ownerProofKindModule,
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
      "@/lib/auth/account-deletion-proof": {
        consumeEmailProofCode: async (...args: unknown[]) => {
          emailCodes.push(args);
          return account.emailCodeOk ?? false;
        },
      },
      "@/lib/auth/reauth": {
        accountHasPassword: () => account.hasPassword,
        confirmSecondStep: async () => {
          calls.push("second-step");
          return null;
        },
        passwordMatchesCurrent: async () => {
          calls.push("password");
          return account.passwordOk ?? false;
        },
      },
    },
  });
  const supabase = { auth: { mfa: { listFactors: async () => ({ data: { totp: Array(account.totp).fill({}) }, error: null }) } } };
  const user = { id: userId, email: "alex@example.com" };
  const confirm = (fields: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return owner.confirmAccountOwner(supabase as never, user as never, form);
  };
  return { confirm, calls, emailCodes };
}

test("with two-step on, only the authenticator (or a recovery code) confirms the owner", async () => {
  const check = ownerCheck({ totp: 1, hasPassword: true, passwordOk: true });
  assert.equal(await check.confirm({ password: "correct horse" }), null);
  assert.deepEqual(check.calls, ["second-step"], "the password is not a way around the authenticator");
});

test("a password account confirms with its current password, and a wrong one fails", async () => {
  assert.equal(await ownerCheck({ totp: 0, hasPassword: true }).confirm({}), "Enter your current password.");
  assert.equal(await ownerCheck({ totp: 0, hasPassword: true, passwordOk: false }).confirm({ password: "guess" }), "That password is incorrect.");
  assert.equal(await ownerCheck({ totp: 0, hasPassword: true, passwordOk: true }).confirm({ password: "correct horse" }), null);
});

test("a Google or Discord account confirms with the code emailed for this session", async () => {
  const wrong = ownerCheck({ totp: 0, hasPassword: false, emailCodeOk: false });
  assert.match((await wrong.confirm({ emailCode: "123456" })) ?? "", /wrong or has expired/);
  assert.deepEqual(plain(wrong.emailCodes), [["account-change", { userId, sessionId }, "123456"]]);

  assert.equal(await ownerCheck({ totp: 0, hasPassword: false, emailCodeOk: true }).confirm({ emailCode: "123456" }), null);
  assert.equal(await ownerCheck({ totp: 0, hasPassword: false, emailCodeOk: true }).confirm({}), "Enter the code we emailed you.");
});

test("an account-wide 'signed in recently' is never proof", () => {
  // The owner signing in on their phone moves last_sign_in_at for every browser.
  assert.doesNotMatch(read("../auth/owner-confirmation.ts"), /last_sign_in_at/);
});

/* ------------------------------------------------------------ the owner pass */

function ownerActions(proofError: string | null) {
  const grants: unknown[] = [];
  const actions = loadServerModule<typeof OwnerActions>(new URL("../actions/owner-confirmation.ts", import.meta.url), {
    mocks: {
      "@/lib/auth": { getSession: async () => ({ role: "member" }) },
      "@/lib/supabase/server": {
        createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } }),
      },
      "@/lib/auth/account-deletion-proof": { sendEmailProofCode: async () => true },
      "@/lib/auth/owner-grant": {
        hasOwnerGrant: async () => false,
        issueOwnerGrant: async (subject: unknown) => {
          grants.push(subject);
          return true;
        },
      },
      "@/lib/auth/owner-confirmation": {
        confirmAccountOwner: async () => proofError,
        ownerGrantSubject: async (id: string) => ({ userId: id, sessionId }),
        ownerProofFor: async () => "password",
      },
      "@/lib/rate-limit": { throttleAuthAction: async () => null },
    },
  });
  return { actions, grants };
}

test("the owner pass is issued only after the proof passes, for this user and session", async () => {
  const failing = ownerActions("That password is incorrect.");
  assert.deepEqual(plain(await failing.actions.confirmAccountOwnerAction(new FormData())), { ok: false, message: "That password is incorrect." });
  assert.equal(failing.grants.length, 0);

  const passing = ownerActions(null);
  assert.deepEqual(plain(await passing.actions.confirmAccountOwnerAction(new FormData())), { ok: true });
  assert.deepEqual(plain(passing.grants), [{ userId, sessionId }]);
});

test("no emailed code for an account that has a password or an authenticator to prove instead", async () => {
  const { actions } = ownerActions(null);
  const result = await actions.sendOwnerEmailCodeAction();
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /password or authenticator/);
});

test("the owner pass lasts 15 minutes, for this user and sign-in only", () => {
  const grant = read("../auth/owner-grant.ts");
  assert.match(grant, /const TTL_SECONDS = 15 \* 60;/);
  assert.match(grant, /deriveGrantKey\(secret, "owner-confirmed"\)/, "its own purpose key");
  assert.match(grant, /httpOnly: true/);
  assert.match(grant, /sameSite: "strict"/);
  assert.match(read("../auth/owner-confirmation.ts"), /sessionId: \(await getSignInSessionId\(\)\) \?\? ""/);
});

/* --------------------------------------------- turning two-step on, first time */

function twoFactorStart(options: { ownerGrant: boolean; totp: number; recovered?: boolean; aal1Enroll?: boolean }) {
  let enrolled = 0;
  const issued: unknown[] = [];
  const actions = loadServerModule<typeof TwoFactorActions>(new URL("../actions/two-factor.ts", import.meta.url), {
    mocks: {
      "next/cache": { revalidatePath() {} },
      "next/navigation": { redirect() {} },
      "@/lib/auth": {
        getSession: async () => ({ username: "Steve_42", recoveredSignIn: options.recovered ?? false }),
        getSignInSessionId: async () => sessionId,
        getTwoFactorPendingUser: async () => null,
      },
      "@/lib/supabase/server": {
        createSupabaseServerClient: async () => ({
          auth: {
            getUser: async () => ({ data: { user: { id: userId } }, error: null }),
            mfa: {
              listFactors: async () => ({ data: { totp: Array(options.totp).fill({ id: "factor" }), all: [] }, error: null }),
              unenroll: async () => ({ error: null }),
              enroll: async () => {
                enrolled += 1;
                // Supabase refuses a new factor at aal1 while a verified one exists.
                if (options.aal1Enroll && enrolled === 1) return { data: null, error: { code: "insufficient_aal" } };
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
      "@/lib/auth/two-factor-recovery": { redeemRecoveryCode: async () => ({ ok: false }), removeAllFactors: async () => true, removeFactor: async () => true },
      "@/lib/auth/recovery-grant": { clearRecoveryGrant: async () => undefined, issueRecoveryGrant: async () => true },
      "@/lib/auth/replace-grant": { clearReplaceGrant: async () => undefined, hasReplaceGrant: async () => true, issueReplaceGrant: async () => true },
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
  return { start: () => actions.startTwoFactorEnrollmentAction(), enrolled: () => enrolled, issued: () => plain(issued) };
}

test("a live session alone cannot turn two-step on: no QR code before 'confirm it's you'", async () => {
  const blocked = twoFactorStart({ ownerGrant: false, totp: 0 });
  assert.deepEqual(plain(await blocked.start()), { ok: false, needsOwnerConfirm: true });
  assert.equal(blocked.enrolled(), 0, "Supabase is not asked to enrol anything");

  const confirmed = twoFactorStart({ ownerGrant: true, totp: 0 });
  const result = await confirmed.start();
  assert.equal(result.ok, true);
  assert.equal(result.factorId, "new-factor");
  assert.equal(confirmed.enrolled(), 1);
});

test("a recovery-code sign-in replacing a lost phone has already proved it's the owner", async () => {
  const recovered = twoFactorStart({ ownerGrant: false, totp: 0, recovered: true });
  assert.equal((await recovered.start()).ok, true);
});

test("replacing a lost phone after a recovery sign-in leaves an owner pass for the confirm step", async () => {
  // Once the old authenticator is removed the next request is no longer a
  // recovery sign-in, so without this pass the confirm step would refuse.
  const replacing = twoFactorStart({ ownerGrant: false, totp: 1, recovered: true, aal1Enroll: true });
  const result = await replacing.start();
  assert.equal(result.ok, true);
  assert.equal(replacing.enrolled(), 2, "enrolled again after the old factor was removed");
  assert.deepEqual(replacing.issued(), [{ userId, sessionId }]);

  const fresh = twoFactorStart({ ownerGrant: true, totp: 0 });
  await fresh.start();
  assert.deepEqual(fresh.issued(), [], "an ordinary first setup issues nothing");
});

test("finishing a first setup checks the owner pass again before the factor is verified", () => {
  const confirm = body(read("../actions/two-factor.ts"), "confirmTwoFactorSetupAction");
  const gate = confirm.indexOf("previous.length === 0 && !actor.recovered && !(await hasOwnerGrant(");
  assert.ok(gate > -1, "the first-setup gate exists");
  assert.ok(gate < confirm.indexOf("mfa.challengeAndVerify("), "checked before the code is verified");
});

/* ------------------------------------------ linking a login, a first password */

test("linking Google or Discord needs the owner pass before Supabase starts the link", () => {
  const auth = read("../actions/auth.ts");
  const oauth = body(auth, "oauthAction");
  const linkBranch = oauth.slice(oauth.indexOf("if (existingUser?.user && (await hasActiveSession()))"));
  const gate = linkBranch.indexOf("hasOwnerGrant(await ownerGrantSubject(existingUser.user.id))");
  assert.ok(gate > -1 && gate < linkBranch.indexOf("supabase.auth.linkIdentity("));
  assert.match(linkBranch.slice(gate, linkBranch.indexOf("supabase.auth.linkIdentity(")), /needsOwnerConfirm: true/);

  const switchDiscord = body(auth, "switchDiscordAction");
  const switchGate = switchDiscord.indexOf("hasOwnerGrant(await ownerGrantSubject(data.user.id))");
  assert.ok(switchGate > -1 && switchGate < switchDiscord.indexOf("supabase.auth.unlinkIdentity("), "checked before the current Discord is unlinked");
});

test("setting a first password needs the owner pass; changing one still needs the current password", () => {
  const update = body(read("../actions/auth.ts"), "updatePasswordAction");
  const current = update.indexOf("passwordMatchesCurrent(email, currentPassword)");
  const first = update.indexOf("} else if (!userData?.user || !(await hasOwnerGrant(await ownerGrantSubject(userData.user.id)))) {");
  const write = update.indexOf("supabase.auth.updateUser(");
  assert.ok(current > -1 && first > current, "the first-password branch is the else of the current-password check");
  assert.ok(write > first, "both run before the password is written");
  assert.match(update.slice(first, write), /return \{ ok: false, needsOwnerConfirm: true, message: CONFIRM_OWNER \};/);
});
