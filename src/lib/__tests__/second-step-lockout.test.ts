import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as resetGrantCore from "@/lib/auth/reset-grant-core";
import { loadServerModule } from "./helpers/server-module";
import type * as Limiter from "@/lib/rate-limit";
import type * as Lockout from "@/lib/auth/login-lockout";
import type * as SecondStep from "@/lib/auth/second-step-lockout";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from > -1, `${start} exists`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}

/** Values made inside the module sandbox have its prototypes: compare plain copies. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const account = "00000000-0000-3000-8000-000000000001";
const otherAccount = "00000000-0000-3000-8000-000000000002";
const PASS = "mz_second_step_device";

/** The real limiter (in-process windows), the real pass code, a fake cookie jar and a movable address. */
function fixture(env: Record<string, string> = { NODE_ENV: "development" }) {
  let ip = "203.0.113.10";
  const jar = new Map<string, string>();
  const sets: Array<{ name: string; options: Record<string, unknown> }> = [];
  const cookieStore = {
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.set(name, value);
      sets.push({ name, options });
    },
    delete: (name: string) => jar.delete(name),
  };
  const headers = { "next/headers": { cookies: async () => cookieStore, headers: async () => new Headers({ "x-forwarded-for": ip }) } };
  const secret = { "@/lib/supabase/secret-key": { supabaseSecretKey: () => "fake-secret-for-tests" } };
  const limiter = loadServerModule<typeof Limiter>(new URL("../rate-limit.ts", import.meta.url), {
    env,
    mocks: { ...headers, "@/lib/redis": { sharedStoreConfig: () => null, redisCommand: async () => { throw new Error("no store"); } } },
  });
  const lockout = loadServerModule<typeof Lockout>(new URL("../auth/login-lockout.ts", import.meta.url), {
    env,
    mocks: { ...headers, ...secret, "@/lib/auth/reset-grant-core": resetGrantCore, "@/lib/rate-limit": limiter },
  });
  const secondStep = loadServerModule<typeof SecondStep>(new URL("../auth/second-step-lockout.ts", import.meta.url), {
    env,
    mocks: {
      ...headers,
      ...secret,
      "@/lib/auth/reset-grant-core": resetGrantCore,
      "@/lib/auth/login-lockout": lockout,
      "@/lib/rate-limit": limiter,
    },
  });
  return { secondStep, lockout, jar, sets, from: (address: string) => { ip = address; } };
}

/* ------------------------------------------------------------- the buckets */

test("wrong codes from someone with only the password do not lock the owner's browser out", async () => {
  const { secondStep, jar, from } = fixture();

  // The owner entered a code on this browser some time ago.
  await secondStep.rememberSecondStepDevice(account);
  const ownerPass = jar.get(PASS);
  assert.ok(ownerPass);
  jar.delete(PASS);

  // Someone else, password in hand, uses up the account's guesses.
  from("198.51.100.20");
  for (let i = 0; i < 5; i++) assert.equal(await secondStep.throttleSecondStepCode(account), null, `guess ${i + 1}`);
  assert.match(String(await secondStep.throttleSecondStepCode(account)), /^Too many attempts\./);

  // The owner, at home, on the browser that holds the pass.
  from("203.0.113.10");
  jar.set(PASS, ownerPass);
  assert.equal(await secondStep.throttleSecondStepCode(account), null, "still gets to enter the code");
});

test("spreading guesses across addresses buys nothing, with or without a pass", async () => {
  const { secondStep, jar, from } = fixture();
  let allowed = 0;
  for (let i = 0; i < 40; i++) {
    from(`198.51.100.${i + 1}`);
    if ((await secondStep.throttleSecondStepCode(account)) === null) allowed += 1;
  }
  assert.equal(allowed, 5, "an account-wide limit, not a per-address one");

  // A pass is a second bucket of the same size, never an exemption.
  await secondStep.rememberSecondStepDevice(account);
  assert.ok(jar.get(PASS));
  for (let i = 0; i < 40; i++) {
    from(`192.0.2.${i + 1}`);
    if ((await secondStep.throttleSecondStepCode(account)) === null) allowed += 1;
  }
  assert.equal(allowed, 10, "five more for a browser that has passed the second step, and no more");

  // Another account's guesses are its own.
  assert.equal(await secondStep.throttleSecondStepCode(otherAccount), null);
});

test("the two buckets together allow what the single bucket did: 20 guesses an hour", () => {
  const source = read("../auth/second-step-lockout.ts");
  assert.match(source, /const WINDOW_MS = 30 \* 60_000;/);
  assert.match(source, /const NEW_BROWSER = \{ scope: "mfa-verify", limit: 5, windowMs: WINDOW_MS \};/);
  assert.match(source, /const PROVEN_BROWSER = \{ scope: "mfa-verify-proven", limit: 5, windowMs: WINDOW_MS \};/);
  // 2 buckets x 5 guesses x 2 windows an hour = the old 5 per 15 minutes.
  assert.equal(2 * 5 * (60 / 30), 5 * (60 / 15));
  // The per-address bucket across accounts is the one throttleAuthAction kept (limit x 5).
  assert.match(source, /const ADDRESS = \{ scope: "mfa-verify:ip", limit: 25, windowMs: 15 \* 60_000 \};/);
  assert.equal((source.match(/failureMode: "closed"/g) ?? []).length, 2, "both buckets refuse when the store is down");
});

test("the limit fails closed in production when the store is missing", async () => {
  const { secondStep } = fixture({ NODE_ENV: "production" });
  assert.match(String(await secondStep.throttleSecondStepCode(account)), /^Too many attempts\./);
});

/* ---------------------------------------------------------------- the pass */

test("the pass is for one account, and a password-only known-device pass is not one", async () => {
  const { secondStep, lockout, jar } = fixture();
  assert.equal(await secondStep.isSecondStepDevice(account), false);

  await secondStep.rememberSecondStepDevice(account);
  assert.equal(await secondStep.isSecondStepDevice(account), true);
  assert.equal(await secondStep.isSecondStepDevice(account.toUpperCase()), true);
  assert.equal(await secondStep.isSecondStepDevice(otherAccount), false, "another account");
  assert.doesNotMatch(Buffer.from(jar.get(PASS)!.split(".")[0], "base64url").toString("utf8"), /00000000-0000/, "never the raw id");

  // Whoever knows the password earns the known-device pass. Offered here, even
  // for the very same identity, it is signed with another key and counts for nothing.
  jar.delete(PASS);
  await lockout.rememberLoginDevice(account);
  jar.set(PASS, jar.get("mz_known_device")!);
  assert.equal(await secondStep.isSecondStepDevice(account), false);

  const [payload, mac] = (await (async () => {
    jar.delete(PASS);
    await secondStep.rememberSecondStepDevice(account);
    return jar.get(PASS)!;
  })()).split(".");
  jar.set(PASS, `${payload}.${mac.slice(0, -2)}AA`);
  assert.equal(await secondStep.isSecondStepDevice(account), false, "tampered");
  assert.notDeepEqual(plain(secondStep.secondStepDeviceKey("fake-secret-for-tests")), plain(lockout.knownDeviceKey("fake-secret-for-tests")));
});

test("the pass cookie is httpOnly, Lax, Secure in production and lasts 180 days", async () => {
  const { secondStep, sets } = fixture({ NODE_ENV: "production" });
  await secondStep.rememberSecondStepDevice(account);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].name, PASS);
  assert.deepEqual(plain(sets[0].options), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 180 * 24 * 60 * 60 });
  await secondStep.rememberSecondStepDevice(undefined);
  assert.equal(sets.length, 1, "nothing to remember without an account");
});

/* -------------------------------------------------------------- the wiring */

test("every authenticator code check counts in the shared buckets, and none keeps the old one", () => {
  const twoFactor = read("../actions/two-factor.ts");
  const reauth = read("../auth/reauth.ts");
  const auth = read("../actions/auth.ts");
  for (const [name, source] of [["two-factor", twoFactor], ["reauth", reauth], ["auth", auth]] as const) {
    assert.doesNotMatch(source, /throttleAuthAction\("mfa-verify"/, name);
  }

  const signIn = between(twoFactor, "export async function verifyTwoFactorAction", "\n}\n");
  const setup = between(twoFactor, "export async function confirmTwoFactorSetupAction", "\n}\n");
  const again = between(reauth, "export async function confirmSecondStep", "\n}\n");
  const reset = between(auth, "async function passResetTwoFactor", "\n}\n");
  for (const [name, source, throttle] of [
    ["sign-in", signIn, "await throttleSecondStepCode(pending.user.id)"],
    ["setup", setup, "await throttleSecondStepCode(actor.user.id)"],
    ["confirm again", again, "await throttleSecondStepCode(user.id)"],
    ["reset", reset, "await throttleSecondStepCode(user.id)"],
  ] as const) {
    const at = source.indexOf(throttle);
    assert.ok(at > 0, `${name} is throttled`);
    assert.ok(at < source.indexOf("challengeAndVerify("), `${name}: before any code is tried`);
  }
});

test("a browser earns the pass only by passing the second step, never with the password", () => {
  const twoFactor = read("../actions/two-factor.ts");
  const signIn = between(twoFactor, "export async function verifyTwoFactorAction", "\n}\n");
  const wrong = signIn.indexOf('if (!verified) return { ok: false, errors: { code: "That code is incorrect or has expired." } };');
  const suspended = signIn.indexOf("await refuseIfSuspended(pending);");
  const pass = signIn.indexOf("await rememberSecondStepDevice(pending.user.id);");
  assert.ok(wrong > 0 && suspended > wrong && pass > suspended, "after the code is right and the account may sign in");

  const recovery = between(twoFactor, "export async function redeemRecoveryCodeAction", "\n}\n");
  assert.ok(recovery.indexOf("await rememberSecondStepDevice(pending.user.id);") > recovery.indexOf("if (!outcome.ok) {"));

  const again = between(read("../auth/reauth.ts"), "export async function confirmSecondStep", "\n}\n");
  assert.match(again, /if \(!error\) \{\s*await rememberSecondStepDevice\(user\.id\);\s*return null;/);
  assert.match(again, /if \(!outcome\.ok\) return "That recovery code is incorrect or has already been used\.";\s*await rememberSecondStepDevice\(user\.id\);/);

  // The password step and a provider sign-in come before the second step.
  const auth = read("../actions/auth.ts");
  assert.doesNotMatch(between(auth, "export async function loginAction", "\n}\n"), /SecondStepDevice/);
  assert.doesNotMatch(read("../../app/auth/callback/route.ts"), /SecondStepDevice/);
  assert.equal((auth.match(/rememberSecondStepDevice\(/g) ?? []).length, 2, "the reset's two ways through, and nowhere else");
  assert.match(read("../auth/second-step-lockout.ts"), /deriveGrantKey\(secret, "known-second-step-device"\)/);
});
