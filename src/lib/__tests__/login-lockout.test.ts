import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as resetGrantCore from "@/lib/auth/reset-grant-core";
import { loadServerModule } from "./helpers/server-module";
import type * as Limiter from "@/lib/rate-limit";
import type * as Lockout from "@/lib/auth/login-lockout";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from > -1, `${start} exists`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}

/** Values made inside the module sandbox have its prototypes: compare plain copies. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const configured = { NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://redis.example.com", UPSTASH_REDIS_REST_TOKEN: "fake-token" };

function limiterWith(env: Record<string, string>, options: { redisCommand?: (args: Array<string | number>) => Promise<unknown>; fetch?: typeof fetch; ip?: () => string } = {}) {
  const store = options.redisCommand ? { url: "https://redis.example.com", token: "fake-token" } : null;
  return loadServerModule<typeof Limiter>(new URL("../rate-limit.ts", import.meta.url), {
    env,
    mocks: {
      "next/headers": { headers: async () => new Headers({ "x-forwarded-for": options.ip?.() ?? "203.0.113.10" }) },
      "@/lib/redis": {
        sharedStoreConfig: () => store,
        redisCommand: options.redisCommand ?? (async () => { throw new Error("no store"); }),
      },
    },
    globals: { fetch: options.fetch },
  });
}

/* ------------------------------------------------------------- peek helper */

test("peeking at a bucket never counts, and reads the same window the counter fills", async () => {
  const limiter = limiterWith({ NODE_ENV: "development" });
  const options = { limit: 3, windowMs: 900_000, failureMode: "closed" as const };
  for (let i = 0; i < 10; i++) assert.equal((await limiter.peekRateLimitShared("fake-bucket", options)).ok, true);
  await limiter.rateLimitShared("fake-bucket", options);
  await limiter.rateLimitShared("fake-bucket", options);
  assert.equal((await limiter.peekRateLimitShared("fake-bucket", options)).ok, true, "two of three used");
  await limiter.rateLimitShared("fake-bucket", options);
  const full = plain(await limiter.peekRateLimitShared("fake-bucket", options));
  assert.equal(full.ok, false, "the limit is reached once three are counted");
  assert.ok(full.retryAfter > 0);
  assert.equal((await limiter.peekRateLimitShared("other-bucket", options)).ok, true);
});

test("peeking fails closed in production with no store, or when the store is down", async () => {
  const missing = limiterWith({ NODE_ENV: "production" });
  assert.equal((await missing.peekRateLimitShared("fake-bucket", { limit: 5, windowMs: 900_000, failureMode: "closed" })).ok, false);
  assert.equal((await missing.peekRateLimitShared("fake-bucket", { limit: 5, windowMs: 900_000 })).ok, true);

  const down = limiterWith(configured, { redisCommand: async () => { throw new Error("fake store outage"); } });
  assert.equal((await down.peekRateLimitShared("fake-bucket", { limit: 5, windowMs: 900_000, failureMode: "closed" })).ok, false);
});

test("the peek reads the exact key rateLimitShared increments", async () => {
  const commands: Array<Array<string | number>> = [];
  let count: string | null = null;
  const fetchCalls: string[] = [];
  const fakeFetch = (async (_url: string, init: { body: string }) => {
    fetchCalls.push(JSON.parse(init.body)[0][1]);
    return new Response(JSON.stringify([{ result: 1 }, { result: 1 }]));
  }) as unknown as typeof fetch;
  const limiter = limiterWith(configured, {
    redisCommand: async (args) => {
      commands.push(args);
      return count;
    },
    fetch: fakeFetch,
  });
  const options = { limit: 8, windowMs: 900_000, failureMode: "closed" as const };
  await limiter.rateLimitShared("fake-bucket", options);
  assert.equal((await limiter.peekRateLimitShared("fake-bucket", options)).ok, true, "an empty bucket");
  assert.equal(commands[0][0], "GET");
  assert.equal(commands[0][1], fetchCalls[0]);
  count = "7";
  assert.equal((await limiter.peekRateLimitShared("fake-bucket", options)).ok, true);
  count = "8";
  assert.equal((await limiter.peekRateLimitShared("fake-bucket", options)).ok, false);
});

/* ------------------------------------------------------- known-device pass */

function lockoutFixture(env: Record<string, string> = { NODE_ENV: "development" }) {
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
  const limiter = limiterWith(env, { ip: () => ip });
  const lockout = loadServerModule<typeof Lockout>(new URL("../auth/login-lockout.ts", import.meta.url), {
    env,
    mocks: {
      "next/headers": { cookies: async () => cookieStore },
      "@/lib/supabase/secret-key": { supabaseSecretKey: () => "fake-secret-for-tests" },
      "@/lib/auth/reset-grant-core": resetGrantCore,
      "@/lib/rate-limit": limiter,
    },
  });
  return { lockout, jar, sets, from: (address: string) => { ip = address; } };
}

test("a pass round-trips, is bound to the account's email, and holds no address", () => {
  const { lockout } = lockoutFixture();
  const key = lockout.knownDeviceKey("fake-secret-for-tests");
  const now = 1_800_000_000;
  const entries = lockout.withKnownAccount([], lockout.accountTag("steve_42@example.com", key), now);
  const token = lockout.signKnownDevice(entries, key);

  assert.equal(lockout.knownDeviceHolds(token, "steve_42@example.com", key, now), true);
  assert.equal(lockout.knownDeviceHolds(token, "Steve_42@Example.com", key, now), true, "email case does not matter");
  assert.equal(lockout.knownDeviceHolds(token, "alex_builder@example.com", key, now), false, "another account");
  assert.equal(lockout.knownDeviceHolds(token, "unresolved:Steve_42", key, now), false);
  assert.doesNotMatch(Buffer.from(token.split(".")[0], "base64url").toString("utf8"), /steve_42|@/i, "never the raw email");

  // Expired, tampered, or signed with another purpose's key: no pass.
  assert.equal(lockout.knownDeviceHolds(token, "steve_42@example.com", key, now + lockout.KNOWN_DEVICE_TTL_SECONDS + 1), false);
  const [payload, mac] = token.split(".");
  assert.equal(lockout.knownDeviceHolds(`${payload}.${mac.slice(0, -2)}AA`, "steve_42@example.com", key, now), false);
  const other = resetGrantCore.deriveGrantKey("fake-secret-for-tests", "owner-confirmed");
  assert.equal(lockout.knownDeviceHolds(token, "steve_42@example.com", other, now), false);
  assert.equal(lockout.knownDeviceHolds(undefined, "steve_42@example.com", key, now), false);
  assert.equal(lockout.knownDeviceHolds("not-a-pass", "steve_42@example.com", key, now), false);
});

test("a browser keeps passes for a few accounts, newest last", () => {
  const { lockout } = lockoutFixture();
  const key = lockout.knownDeviceKey("fake-secret-for-tests");
  let entries: ReturnType<typeof lockout.withKnownAccount> = [];
  for (let i = 1; i <= 7; i++) entries = lockout.withKnownAccount(entries, lockout.accountTag(`player_${i}@example.com`, key), 1_000 + i);
  const token = lockout.signKnownDevice(entries, key);
  assert.equal(lockout.readKnownDevice(token, key, 1_000).length, 5);
  assert.equal(lockout.knownDeviceHolds(token, "player_7@example.com", key, 1_000), true);
  assert.equal(lockout.knownDeviceHolds(token, "player_1@example.com", key, 1_000), false, "the oldest drops off");
  // Signing in again to one already there does not duplicate it.
  const again = lockout.withKnownAccount(entries, lockout.accountTag("player_7@example.com", key), 2_000);
  assert.equal(again.length, 5);
});

test("the pass cookie is httpOnly, Lax, Secure in production and lasts 180 days", async () => {
  const { lockout, sets } = lockoutFixture({ NODE_ENV: "production" });
  await lockout.rememberLoginDevice("steve_42@example.com");
  assert.equal(sets.length, 1);
  assert.deepEqual(plain(sets[0].options), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 180 * 24 * 60 * 60 });
  await lockout.rememberLoginDevice(undefined);
  assert.equal(sets.length, 1, "nothing to remember without an email");
});

/* ------------------------------------------------------------ the lockout */

test("only one sign-in per account and address is checked at a time", async () => {
  const { lockout, from } = lockoutFixture();
  from("203.0.113.10");
  const release = await lockout.holdLoginAttempt("steve_42@example.com");
  assert.ok(release, "the first attempt holds it");
  assert.equal(await lockout.holdLoginAttempt("steve_42@example.com"), null, "a parallel guess waits");
  assert.ok(await lockout.holdLoginAttempt("alex_builder@example.com"), "another account is not held");
  from("198.51.100.20");
  assert.ok(await lockout.holdLoginAttempt("steve_42@example.com"), "the owner elsewhere is not held");
  from("203.0.113.10");
  await release!();
  assert.ok(await lockout.holdLoginAttempt("steve_42@example.com"), "free again once the attempt ends");
});

test("wrong passwords lock an account for that address, not for its owner elsewhere", async () => {
  const { lockout, from } = lockoutFixture();
  const account = "steve_42@example.com";
  from("203.0.113.10");
  for (let i = 0; i < 7; i++) await lockout.recordLoginFailure(account);
  assert.equal(await lockout.loginLockedOut(account), null, "seven of eight");
  await lockout.recordLoginFailure(account);
  assert.match(String(await lockout.loginLockedOut(account)), /^Too many attempts\./);

  from("198.51.100.20");
  assert.equal(await lockout.loginLockedOut(account), null, "the owner on another address is not locked out");
  assert.equal(await lockout.loginLockedOut("alex_builder@example.com"), null);
});

test("guessing spread across addresses locks the account, except for a browser that signed in before", async () => {
  const { lockout, from, jar } = lockoutFixture();
  const account = "steve_42@example.com";

  // The owner signed in on this browser earlier.
  await lockout.rememberLoginDevice(account);
  const ownerPass = jar.get("mz_known_device");
  assert.ok(ownerPass);
  jar.delete("mz_known_device");

  for (let i = 0; i < 50; i++) {
    from(`198.51.100.${(i % 10) + 1}`);
    await lockout.recordLoginFailure(account);
  }
  from("192.0.2.7");
  assert.match(String(await lockout.loginLockedOut(account)), /^Too many attempts\./, "no pass: the account-wide limit applies");

  jar.set("mz_known_device", ownerPass);
  assert.equal(await lockout.loginLockedOut(account), null, "the owner's browser still gets in");
  assert.equal(await lockout.loginLockedOut("alex_builder@example.com"), null, "other accounts are untouched");

  // The pass is never an exemption from the per-address bucket.
  for (let i = 0; i < 8; i++) await lockout.recordLoginFailure(account);
  assert.match(String(await lockout.loginLockedOut(account)), /^Too many attempts\./);
});

test("a name that matches nobody is locked out exactly like a real account", async () => {
  const { lockout, from } = lockoutFixture();
  from("203.0.113.10");
  const real = "steve_42@example.com";
  const unknown = "unresolved:Ghost_Player";
  for (let i = 0; i < 7; i++) {
    await lockout.recordLoginFailure(real);
    await lockout.recordLoginFailure(unknown);
  }
  assert.equal(await lockout.loginLockedOut(real), null);
  assert.equal(await lockout.loginLockedOut(unknown), null);
  await lockout.recordLoginFailure(real);
  await lockout.recordLoginFailure(unknown);
  assert.equal(await lockout.loginLockedOut(unknown), await lockout.loginLockedOut(real));
  assert.ok(await lockout.loginLockedOut(unknown));
});

test("the lockout fails closed in production when the store is missing", async () => {
  const { lockout } = lockoutFixture({ NODE_ENV: "production" });
  assert.match(String(await lockout.loginLockedOut("steve_42@example.com")), /^Too many attempts\./);
});

/* ------------------------------------------------------------- the wiring */

test("sign-in checks the counts first and counts only a wrong password", () => {
  const login = between(read("../actions/auth.ts"), "export async function loginAction", "\n}\n");
  assert.doesNotMatch(login, /"login-account"/, "no bucket counts every attempt against an account");
  assert.doesNotMatch(login, /throttleAuthAction\("login", \{[^}]*identity/, "nor against what was typed");

  const peek = login.indexOf("await loginLockedOut(lockoutIdentity)");
  const hold = login.indexOf("const release = await holdLoginAttempt(lockoutIdentity);");
  const attempt = login.indexOf("supabase.auth.signInWithPassword(");
  const record = login.indexOf('if (error && classifyPasswordProbe(error) === "wrong") await recordLoginFailure(lockoutIdentity);');
  const released = login.indexOf("await release();");
  const unconfirmed = login.indexOf("if (isUnconfirmedEmailError(error)) {");
  const failed = login.indexOf("return { ok: false, message: SIGN_IN_FAILED };");
  const remember = login.indexOf("await rememberLoginDevice(loginEmail);");
  assert.ok(peek > 0 && hold > peek && attempt > hold && record > attempt && released > record && unconfirmed > released && failed > unconfirmed && remember > failed);
  assert.match(login, /\} finally \{\s*await release\(\);/, "the hold is released however the attempt ends");
  assert.equal((login.match(/recordLoginFailure\(/g) ?? []).length, 1, "counted in one place only");
});

test("a passkey or provider sign-in also remembers the browser, and signing out keeps it", () => {
  const passkeys = between(read("../actions/passkeys.ts"), "export async function finishPasskeySignInAction", "\n}\n");
  const verified = passkeys.indexOf("if (error || !signedIn?.user) {");
  assert.ok(verified > 0 && passkeys.indexOf("await rememberLoginDevice(signedIn.user.email);") > verified);

  const callback = read("../../app/auth/callback/route.ts");
  const exchanged = callback.indexOf("if (data.user) {");
  assert.ok(exchanged > 0 && callback.indexOf("await rememberLoginDevice(data.user.email);") > exchanged);

  const destroy = between(read("../auth/index.ts"), "export async function destroySession", "\n}\n");
  assert.doesNotMatch(destroy, /known_device|KnownDevice|LoginDevice/);
});

test("every current-password check also passes one shared per-account bucket", () => {
  const limiter = read("../rate-limit.ts");
  assert.match(limiter, /accountKey\("current-password", accountId\), \{\s*limit: 10,\s*windowMs: 15 \* 60_000,\s*failureMode: "closed",/);

  const update = between(read("../actions/auth.ts"), "export async function updatePasswordAction", "\n}\n");
  const owner = between(read("../auth/owner-confirmation.ts"), "export async function confirmAccountOwner", "\n}\n");
  const remove = between(read("../actions/account.ts"), "export async function deleteAccountAction", "\n}\n");
  for (const [name, source, own, check] of [
    ["password-update", update, 'throttleAuthAction("password-update"', "await passwordMatchesCurrent(email, currentPassword)"],
    ["reauth-password", owner, 'throttleAuthAction("reauth-password"', "await passwordMatchesCurrent(user.email, password)"],
    ["account-delete", remove, 'throttleAuthAction("account-delete"', "await passwordMatchesCurrent(auth.user.email, currentPassword)"],
  ] as const) {
    const ownAt = source.indexOf(own);
    const sharedAt = source.indexOf("await throttleCurrentPasswordCheck(");
    const checkAt = source.indexOf(check);
    assert.ok(ownAt > -1, `${name} keeps its own bucket`);
    assert.ok(sharedAt > -1 && checkAt > sharedAt, `${name} passes the shared bucket before the password is tried`);
  }
});

test("both wrong-code answers of the email code wait for the same floor", () => {
  const code = between(read("../actions/auth.ts"), "export async function confirmEmailCodeAction", "export async function resendConfirmationAction");
  const started = code.indexOf("const startedAt = Date.now();");
  const lookup = code.indexOf("const before = await findAccountByEmail(parsed.data.email);");
  assert.ok(started > 0 && started < lookup, "timed from before the lookup");
  assert.equal((code.match(/await notSoonerThan\(startedAt, CODE_ANSWER_FLOOR_MS\);\s*return \{ ok: false, errors: \{ token: "That code is incorrect or has expired\." \} \};/g) ?? []).length, 2);
});

test("saving a profile is limited per account", () => {
  const update = between(read("../actions/account.ts"), "export async function updateProfileAction", "\n}\n");
  const signedIn = update.indexOf("const auth = await authenticatedUser();");
  const limit = update.indexOf('rateLimitShared(accountKey("profile-update", auth.user.id), { limit: 20, windowMs: 10 * 60_000 })');
  const write = update.indexOf('.from("profiles")');
  assert.ok(signedIn > 0 && limit > signedIn && write > limit);
});
