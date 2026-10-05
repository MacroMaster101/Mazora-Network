import "server-only";

import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { listAllAuthUsers } from "@/lib/data/accounts";
import {
  authCookieNames,
  mayReplacePending,
  neutralProfileNames,
  unguessablePassword,
  type AccountLookup,
  type TokenLookup,
} from "@/lib/auth/signup-trust-core";

/**
 * The server side of "whose password may a new account keep" (the rules and
 * the reasoning are in signup-trust-core.ts).
 *
 * Not a "use server" file: these take a user id or an email and must never be
 * callable from the browser.
 */

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * The account an email address belongs to, confirmed or not.
 *
 * Asked BEFORE a registration reaches the auth server, so a stale pending
 * account can be replaced first and only one confirmation email goes out.
 *
 * The app's own connection answers first. Without it, or when the query fails,
 * the service-role client pages through the accounts instead, so a deployment
 * with no DATABASE_URL can still register people. Only when neither can answer
 * is the result "unreadable", which callers must not treat as "no account".
 */
export async function findAccountByEmail(email: string): Promise<AccountLookup> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return { status: "none" };

  const db = getDb();
  if (db) {
    try {
      // The auth server stores addresses in lower case. Times come back as
      // text so their shape does not depend on the database driver.
      const rows = (await db.execute(
        sql`select id::text as id,
                   email_confirmed_at::text as email_confirmed_at,
                   invited_at::text as invited_at,
                   last_sign_in_at::text as last_sign_in_at
            from auth.users
            where email = ${wanted}
            limit 2`,
      )) as unknown as Array<{
        id: string;
        email_confirmed_at: string | null;
        invited_at: string | null;
        last_sign_in_at: string | null;
      }>;
      if (rows.length === 0) return { status: "none" };
      // Two accounts for one address should not exist; if they do, nothing
      // here may guess which one a registration is about.
      if (rows.length > 1) return { status: "unreadable" };
      const [row] = rows;
      return {
        status: "found",
        account: {
          id: row.id,
          emailConfirmedAt: row.email_confirmed_at,
          invitedAt: row.invited_at,
          lastSignInAt: row.last_sign_in_at,
        },
      };
    } catch (error) {
      console.error("Account lookup by email failed", error);
    }
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "unreadable" };
  try {
    const { users, error, truncated } = await listAllAuthUsers(admin);
    if (error) {
      console.error("Account lookup by email (fallback) failed", error);
      return { status: "unreadable" };
    }
    const matches = users.filter((user) => (user.email ?? "").toLowerCase() === wanted);
    if (matches.length > 1) return { status: "unreadable" };
    // Not found in a list that was cut short is not "no account".
    if (matches.length === 0) return truncated ? { status: "unreadable" } : { status: "none" };
    const [user] = matches;
    return {
      status: "found",
      account: {
        id: user.id,
        emailConfirmedAt: user.email_confirmed_at ?? user.confirmed_at ?? null,
        invitedAt: user.invited_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
      },
    };
  } catch (error) {
    console.error("Account lookup by email (fallback) failed", error);
    return { status: "unreadable" };
  }
}

type TokenRow = { id: string; email_confirmed_at: string | null; invited_at: string | null };

function tokenLookupFrom(rows: TokenRow[]): TokenLookup {
  if (rows.length === 0) return { status: "none" };
  if (rows.length > 1) return { status: "several" };
  const [row] = rows;
  return {
    status: "found",
    account: { id: row.id, emailConfirmedAt: row.email_confirmed_at, invitedAt: row.invited_at },
  };
}

/**
 * The account an emailed sign-up link belongs to, asked BEFORE the link is
 * verified so a link that is not a first confirmation can be refused unspent.
 *
 * This assumes the token hash in the email is the value the auth server keeps
 * in `confirmation_token`. Safety does not rest on that: the check made after
 * verifying (firstSignupConfirmation) is what protects a confirmed account.
 * If the assumption ever stopped holding, every link would come back "none"
 * and be refused unspent, and the 6-digit code would still confirm.
 *
 * Only the app's own connection can answer; without it the result is
 * "unreadable". The admin API cannot search by token.
 */
export async function findAccountByConfirmationToken(tokenHash: string): Promise<TokenLookup> {
  // An account with no token outstanding stores an empty string, so an empty
  // value would match every one of them.
  if (!tokenHash) return { status: "none" };
  const db = getDb();
  if (!db) return { status: "unreadable" };
  try {
    const rows = (await db.execute(
      sql`select id::text as id,
                 email_confirmed_at::text as email_confirmed_at,
                 invited_at::text as invited_at
          from auth.users
          where confirmation_token = ${tokenHash}
          limit 2`,
    )) as unknown as TokenRow[];
    return tokenLookupFrom(rows);
  } catch (error) {
    console.error("Account lookup by confirmation token failed", error);
    return { status: "unreadable" };
  }
}

/**
 * The account an emailed reset link belongs to, asked BEFORE the link is
 * verified: verifying a reset also confirms an unconfirmed email, and
 * afterwards an account confirmed by this link looks the same as one confirmed
 * a minute ago by its owner. Same assumption about the stored token as above,
 * and the same fallback: with no answer, the confirmation time decides.
 */
export async function findAccountByRecoveryToken(tokenHash: string): Promise<TokenLookup> {
  if (!tokenHash) return { status: "none" };
  const db = getDb();
  if (!db) return { status: "unreadable" };
  try {
    const rows = (await db.execute(
      sql`select id::text as id,
                 email_confirmed_at::text as email_confirmed_at,
                 invited_at::text as invited_at
          from auth.users
          where recovery_token = ${tokenHash}
          limit 2`,
    )) as unknown as TokenRow[];
    return tokenLookupFrom(rows);
  } catch (error) {
    console.error("Account lookup by recovery token failed", error);
    return { status: "unreadable" };
  }
}

/**
 * Deletes a pending sign-up so the address can be registered afresh, with the
 * new registrant's password, a new account id and a confirmation email that
 * works. The profile and any Minecraft link go with it and the name is free
 * again.
 *
 * With a database it is one statement that deletes only if the account is
 * still replaceable, the same conditions as mayReplacePending: checking first
 * and deleting second left a moment in which the account could be confirmed
 * and then deleted anyway. Deleting the row directly removes what the admin
 * API's `deleteUser` (the daily cleanup's way) removes, because that work is
 * done by the database itself: the `prepare_account_delete` trigger and the
 * ON DELETE rules on every table that points at auth.users (migration 032).
 * No row deleted means not replaced.
 *
 * Without a database, or when the statement fails, the account is read again
 * here, immediately before deleting: a confirmed account or a staff invite is
 * never deleted, whatever the earlier lookup said. False when anything is not
 * as expected; the caller then creates nothing.
 */
export async function replacePendingSignup(admin: Admin, userId: string, email: string): Promise<boolean> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;

  const db = getDb();
  if (db) {
    try {
      const rows = (await db.execute(
        sql`delete from auth.users
            where id = ${userId}::uuid
              and lower(btrim(email)) = ${wanted}
              and email_confirmed_at is null
              and confirmed_at is null
              and invited_at is null
              and last_sign_in_at is null
              and created_at is not null
            returning id`,
      )) as unknown as Array<{ id: string }>;
      if (rows.length === 1) return true;
      console.error("Pending sign-up was not replaced: it is gone, confirmed, invited, signed in, or for another address");
      return false;
    } catch (error) {
      console.error("Pending sign-up could not be deleted directly; using the admin API", error);
    }
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    console.error("Pending sign-up could not be read before replacing it:", error?.message ?? "no such account");
    return false;
  }
  if (!mayReplacePending(data.user, email)) {
    console.error("Pending sign-up was not replaced: it is confirmed, invited, signed in, or for another address");
    return false;
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("Pending sign-up could not be deleted:", deleteError.message);
    return false;
  }
  return true;
}

/**
 * - "removed": the account has no password at all, and its sessions are untouched.
 * - "replaced": the direct write failed, so the auth server set a password
 *   nobody knows instead. That signs the account out everywhere.
 * - "failed": the password on the account is still whatever it was.
 */
export type PasswordRemoval = "removed" | "replaced" | "failed";

/**
 * Takes away a password that nothing shows is the account owner's.
 *
 * Written straight to auth.users, as endAllSessions does for sessions: the
 * admin API can only SET a password, and doing that ends every session and
 * clears the account's emailed codes, which would cut a password reset off
 * half way. A missing hash is how the auth server stores an account that signs
 * in some other way, so no password matches it.
 *
 * The same statement records `has_password: false` in app_metadata (which only
 * the service role can write), so accountHasPassword does not go on answering
 * "yes" from the account's email identity. markHasPassword turns it back.
 */
export async function removeAccountPassword(userId: string): Promise<PasswordRemoval> {
  const db = getDb();
  if (db) {
    try {
      const rows = (await db.execute(
        sql`update auth.users
            set encrypted_password = null,
                raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"has_password": false}'::jsonb,
                updated_at = now()
            where id = ${userId}::uuid
            returning id`,
      )) as unknown as Array<{ id: string }>;
      if (rows.length === 1) return "removed";
      console.error("Password removal matched no account");
    } catch (error) {
      console.error("Password removal failed", error);
    }
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: unguessablePassword() });
    if (!error) return "replaced";
    console.error("Password replacement failed:", error.message);
  }
  // Said here as well as by the caller: this is also where an account ends up
  // when there is neither a database nor a service-role client.
  console.error("An untrusted password is still on its account: it could be neither removed nor replaced");
  return "failed";
}

/**
 * Second way to record "this account has a password", for when the admin API
 * could not. It matters after removeAccountPassword: a `has_password: false`
 * left behind would let a signed-in browser skip the current-password check on
 * an account that has one again.
 */
export async function recordPasswordSet(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.execute(
      sql`update auth.users
          set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"has_password": true}'::jsonb
          where id = ${userId}::uuid`,
    );
    return true;
  } catch (error) {
    console.error("Recording the new password failed", error);
    return false;
  }
}

/**
 * Puts the neutral placeholder names back on an account whose registration
 * details are unproven: the handle and display name were typed by whoever
 * registered the address, who may be a stranger. The auth metadata goes too,
 * because the site falls back to it wherever the profile holds a placeholder.
 * The owner picks their own names from the dashboard.
 *
 * Best-effort. The password is what decides who can get in; a name that could
 * not be reset is logged and left.
 */
export async function resetUnprovenNames(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("Unproven sign-up names were not reset: no service-role client");
    return;
  }
  const names = neutralProfileNames(userId);
  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({ username: names.username, display_name: names.displayName, updated_at: now })
    .eq("user_id", userId);
  if (error) {
    console.error("Unproven sign-up handle was not reset:", error.message);
    // The handle is unique, the display name is not: reset what can be.
    await admin.from("profiles").update({ display_name: names.displayName, updated_at: now }).eq("user_id", userId);
  }
  // A key sent as null is removed; the rest of the metadata is kept.
  const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { username: null, display_name: null },
  });
  if (metadataError) console.error("Unproven sign-up metadata was not reset:", metadataError.message);
}

/**
 * Ends this browser's session and nothing else. When the sign-out itself
 * reports an error the auth cookies are cleared by hand, so a refusal never
 * leaves the visitor signed in to an account they were just turned away from.
 */
export async function endLocalSession(supabase: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (!error) return;
    console.error("Local sign-out failed; clearing the auth cookies:", error.message);
  } catch (error) {
    console.error("Local sign-out failed; clearing the auth cookies:", error);
  }
  const store = await cookies();
  const present = store.getAll().map(({ name }) => name);
  for (const name of authCookieNames(getSupabaseConfig()?.url, present)) store.delete(name);
}
