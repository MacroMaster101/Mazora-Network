import { randomBytes } from "node:crypto";
import { selectExpiredUnconfirmed, type AuthUserLike } from "@/lib/cleanup-rules";
import { isPendingInvite } from "@/lib/auth/pending-invite";
import { PLACEHOLDER_DISPLAY_NAME } from "@/lib/auth/placeholder";

/**
 * Pure rules for whose password a new account may keep (see signup-trust.ts).
 *
 * Anyone can register someone else's address with a password of their own; the
 * account sits unconfirmed until the real owner confirms it from the inbox.
 * One rule covers it: a password is trusted only when the browser that
 * confirms the email is the browser whose registration created that exact
 * account. Everything else confirms the email and throws the password away,
 * and the owner chooses one through "Forgot password", which needs the inbox.
 */

/** A sign-up link opened where nothing was registered. The link is not spent, so it still works. */
export const SIGNUP_LINK_ELSEWHERE =
  "Open this link in the browser you registered in, or type the 6-digit code from the email there.";

/** The email is confirmed and the account has no password, so one is chosen through the inbox. */
export const UNPROVEN_SIGNUP_MESSAGE =
  "Your email is confirmed. Choose your password with 'Forgot password' before logging in.";

/** Confirmed, but the untrusted password could not be removed. An error, never shown as a success. */
export const UNPROVEN_SIGNUP_UNSECURED =
  "Your email is confirmed, but we couldn't finish securing the account. Choose your password with 'Forgot password' before logging in.";

/** What a by-email lookup returns: just enough to tell the three kinds of account apart. */
export interface AccountByEmail {
  id: string;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
}

export type AccountLookup =
  | { status: "found"; account: AccountByEmail }
  | { status: "none" }
  // The read failed, so nothing is known. Never the same as "none".
  | { status: "unreadable" };

/**
 * - "confirmed": someone has proved the inbox. A registration never touches it.
 * - "invite": a staff invitation not yet accepted. It carries a rank and has
 *   no password; it is accepted through its own link and never replaced.
 * - "pending": a self sign-up nobody has confirmed. Its password is whatever
 *   the first registrant typed, which is the whole problem.
 */
export type EmailStanding = "confirmed" | "invite" | "pending";

export function emailStanding(account: AccountByEmail): EmailStanding {
  if (account.emailConfirmedAt) return "confirmed";
  const invite = isPendingInvite({
    invited_at: account.invitedAt,
    last_sign_in_at: account.lastSignInAt,
    email_confirmed_at: account.emailConfirmedAt,
  });
  return invite ? "invite" : "pending";
}

/**
 * What trying the typed password against a pending account showed.
 *
 * - "opens": the auth server said "email not confirmed", which it only says
 *   once the password is right.
 * - "wrong": the auth server said the credentials are invalid.
 * - "unknown": anything else (rate limited, unreachable, a server error, no
 *   configuration, or an answer a pending account should not give). It proves
 *   nothing either way, so nothing is deleted, created or marked on it.
 */
export type PasswordProbe = "opens" | "wrong" | "unknown";

/**
 * Reads the auth server's answer to a password sign-in on a pending account.
 * Matched by code first (current API) with a message fallback (older clients).
 * A sign-in that succeeded is "unknown" too: a pending account cannot sign in,
 * so the account is not what the lookup said it was.
 */
export function classifyPasswordProbe(error: { code?: string; message?: string } | null | undefined): PasswordProbe {
  if (!error) return "unknown";
  if (error.code === "email_not_confirmed") return "opens";
  if (error.code === "invalid_credentials") return "wrong";
  // A code this does not know is not guessed at from its message.
  if (error.code) return "unknown";
  if (/email not confirmed/i.test(error.message ?? "")) return "opens";
  if (/invalid login credentials/i.test(error.message ?? "")) return "wrong";
  return "unknown";
}

export type RegistrationPlan =
  /** The Minecraft name belongs to another account. */
  | { step: "refuse-username" }
  /** The password could not be tried against the pending account: stop, and change nothing. */
  | { step: "unfinished" }
  /** A staff invite holds the address: answer like any other, send and change nothing. */
  | { step: "neutral" }
  /** Hand the address to the auth server: a new account, or its own answer for a confirmed one. */
  | { step: "sign-up" }
  /** This visitor's own unfinished registration, same password and name: no new mail. */
  | { step: "resume"; userId: string }
  /** Someone else's password is on the pending account: delete it, then sign up afresh. */
  | { step: "replace"; userId: string };

/**
 * What a registration does, given what already exists for the address.
 *
 * `passwordOpens` asks whether the password just typed opens the pending
 * account. It is only called when the answer matters, so a confirmed account
 * or an invite is never probed.
 *
 * Only a definite "wrong" replaces the account. Without that, a registrant
 * retrying while the auth server was rate limiting or down would have their
 * own pending account deleted.
 *
 * A name "taken" by the pending account for this same address is not a
 * conflict: that account is about to be resumed or replaced. Without this,
 * registering someone's address together with their Minecraft name locked the
 * owner out of their own registration.
 */
export async function planRegistration(input: {
  existing: AccountByEmail | null;
  username: { available: true } | { available: false; userId: string };
  passwordOpens: () => Promise<PasswordProbe>;
}): Promise<RegistrationPlan> {
  const standing = input.existing ? emailStanding(input.existing) : null;
  const pendingId = input.existing && standing === "pending" ? input.existing.id : null;
  const nameIsItsOwn = !input.username.available && pendingId !== null && input.username.userId === pendingId;

  if (!input.username.available && !nameIsItsOwn) return { step: "refuse-username" };
  if (standing === "invite") return { step: "neutral" };
  if (pendingId === null) return { step: "sign-up" };
  const probe = await input.passwordOpens();
  if (probe === "wrong") return { step: "replace", userId: pendingId };
  if (probe !== "opens") return { step: "unfinished" };
  // The password is theirs. With the same name there is nothing new to send;
  // with another name the auth server resends the confirmation, as before.
  return nameIsItsOwn ? { step: "resume", userId: pendingId } : { step: "sign-up" };
}

/**
 * Whether a pending account may be deleted to make way for a new registration
 * of the same address. Read from the auth server immediately before deleting.
 *
 * The line is the one the daily unconfirmed-account cleanup draws (never
 * confirmed, never signed in, not an invitation), minus the age: this account
 * would be reaped anyway, it just is not old enough yet. An account with no
 * readable creation date is left alone.
 */
export function mayReplacePending(user: AuthUserLike, email: string): boolean {
  const wanted = email.trim().toLowerCase();
  if (!wanted || (user.email ?? "").trim().toLowerCase() !== wanted) return false;
  return selectExpiredUnconfirmed([user], Number.POSITIVE_INFINITY, 0).length === 1;
}

/**
 * The rule itself: the confirming browser carries the marker for exactly the
 * account that was just confirmed. No marker, or one for another account (an
 * earlier registration since replaced), proves nothing about the password.
 */
export function signupProvenHere(marker: string | null | undefined, verifiedUserId: string | null | undefined): boolean {
  return Boolean(marker) && Boolean(verifiedUserId) && marker === verifiedUserId;
}

/**
 * How far the auth server's clock and this server's may disagree and a
 * confirmation still count as "just now". Deliberately generous: being wrong
 * in this direction only removes a password from someone who is in the middle
 * of choosing a new one. Being wrong the other way would leave a stranger's
 * password on a confirmed account.
 */
export const JUST_CONFIRMED_MARGIN_MS = 5 * 60_000;

/**
 * Whether a password-reset verification is what confirmed the email, meaning
 * the account was never confirmed by a registration and its password is
 * whatever the first registrant typed.
 *
 * `confirmedBefore` is the reliable answer: what a lookup said just before the
 * token was verified (true/false), or null when there was nothing to compare
 * (the emailed link, where the address is only known afterwards, or a failed
 * lookup). Then the confirmation time on the verified account decides: within
 * the margin of now means this verification set it. A missing or unreadable
 * time counts as "just now", the safe side.
 */
export function resetConfirmedTheEmail(input: {
  confirmedBefore: boolean | null;
  emailConfirmedAt: string | null | undefined;
  nowMs: number;
}): boolean {
  if (input.confirmedBefore !== null) return !input.confirmedBefore;
  const confirmedAt = input.emailConfirmedAt ? Date.parse(input.emailConfirmedAt) : Number.NaN;
  if (!Number.isFinite(confirmedAt)) return true;
  return Math.abs(input.nowMs - confirmedAt) <= JUST_CONFIRMED_MARGIN_MS;
}

/**
 * Whether a sign-up verification is what confirmed this account, so the rules
 * for a first confirmation (keep or remove the password, reset the names) may
 * be applied to it at all.
 *
 * It is not when the account was confirmed long before: the auth server's
 * `email` link type also accepts a password-reset token, so a reset link
 * edited to say `type=email` verifies on an old, confirmed account. Nor when
 * the account was created by a staff invitation, which has its own link and
 * never had a registrant's password. Treating either as a new sign-up would
 * remove a real owner's password and names.
 *
 * `confirmedBefore` and the time rule are resetConfirmedTheEmail's: a lookup
 * made just before the token was spent decides when there is one, and the
 * confirmation time decides otherwise.
 */
export function firstSignupConfirmation(input: {
  confirmedBefore: boolean | null;
  emailConfirmedAt: string | null | undefined;
  invitedAt: string | null | undefined;
  nowMs: number;
}): boolean {
  if (input.invitedAt) return false;
  return resetConfirmedTheEmail(input);
}

/** The account a one-time token belongs to, read before the token is spent. */
export interface AccountByToken {
  id: string;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
}

export type TokenLookup =
  | { status: "found"; account: AccountByToken }
  | { status: "none" }
  /** More than one account holds the token, so it says nothing about any of them. */
  | { status: "several" }
  // No database, or the read failed. Never the same as "none".
  | { status: "unreadable" };

/**
 * What to do with an emailed sign-up link, from who holds its token:
 *
 * - "proceed": exactly one account, never confirmed and not an invitation.
 * - "refuse": an account that could be read and is not that. The token is
 *   left unspent.
 * - "unknown": nothing could be read, or no account holds the token. The link
 *   is verified and firstSignupConfirmation decides afterwards. "No account"
 *   is not a refusal: if the emailed hash ever differed from the stored one,
 *   refusing here would turn away every sign-up link, while an unknown token
 *   simply fails to verify.
 */
export function signupLinkStanding(lookup: TokenLookup): "proceed" | "refuse" | "unknown" {
  if (lookup.status === "unreadable" || lookup.status === "none") return "unknown";
  if (lookup.status !== "found") return "refuse";
  return lookup.account.emailConfirmedAt || lookup.account.invitedAt ? "refuse" : "proceed";
}

/**
 * Whether an account was confirmed before a token was verified, from a lookup
 * made just before. Null when the lookup is not about the verified account or
 * found nothing to go on.
 */
export function confirmedBeforeVerifying(
  lookup: { status: string; account?: { id: string; emailConfirmedAt: string | null } },
  verifiedUserId: string | null | undefined,
): boolean | null {
  if (lookup.status !== "found" || !lookup.account || !verifiedUserId) return null;
  if (lookup.account.id !== verifiedUserId) return null;
  return Boolean(lookup.account.emailConfirmedAt);
}

/**
 * Whether a reset that confirmed the email may also put the placeholder names
 * back. Only when a lookup showed the account was unconfirmed beforehand: the
 * time rule alone cannot tell it from an account confirmed minutes ago (a new
 * registration, a first social login, a staff invite just accepted), and those
 * names are the owner's own.
 */
export function resetMayResetNames(confirmedBefore: boolean | null): boolean {
  return confirmedBefore === false;
}

/**
 * What the sign-up trigger stores for an account that arrives with no names
 * (see placeholder.ts). An unproven confirmation puts these back: the names on
 * the account were typed by whoever registered it, who may be a stranger.
 */
export function neutralProfileNames(userId: string): { username: string; displayName: string } {
  return { username: `player_${userId.slice(0, 8).toLowerCase()}`, displayName: PLACEHOLDER_DISPLAY_NAME };
}

/**
 * A password nobody knows. Only the fallback for when the hash cannot be
 * blanked directly. 64 random characters plus one of each class a password
 * policy may ask for, and under bcrypt's 72-byte limit.
 */
export function unguessablePassword(): string {
  return `${randomBytes(48).toString("base64url")}aA1!`;
}

/**
 * Every cookie that can hold this project's Supabase session: the ones the
 * browser sent, plus the default name and its chunks in case the session was
 * written during this same request and is not among them yet.
 */
export function authCookieNames(supabaseUrl: string | null | undefined, present: readonly string[]): string[] {
  const names = new Set(present.filter((name) => name.startsWith("sb-") && name.includes("auth-token")));
  try {
    const base = `sb-${new URL(supabaseUrl ?? "").hostname.split(".")[0]}-auth-token`;
    names.add(base);
    for (let chunk = 0; chunk < 5; chunk += 1) names.add(`${base}.${chunk}`);
  } catch {
    // No usable URL: the cookies that were sent are all there is to go on.
  }
  return [...names];
}
