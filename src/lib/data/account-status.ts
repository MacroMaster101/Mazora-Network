import "server-only";
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Account suspension.
 *
 * `profiles.account_status` is the switch. getSession refuses any profile that
 * is not "active", so a suspended member is signed out of every page and
 * action on their next request, whatever their cookie says. Suspending also
 * ends their Supabase sessions (endAllSessions), so the refresh token is gone
 * as well and the browser cannot quietly renew its access token.
 *
 * Nothing is deleted: rank, orders, posts and settings all stay, and
 * unsuspending puts the account back exactly as it was.
 */

export type AccountStatus = "pending" | "active" | "suspended" | "deleted";

/**
 * What a status read can come back with. `null` means the read worked and the
 * account has no profile row yet (a brand-new account, before its profile
 * exists). "unreadable" means the read itself failed, so nothing is known:
 * callers must not treat that as "not suspended".
 */
export type AccountStatusRead = AccountStatus | "unreadable" | null;

export const STATUS_UNREADABLE = "unreadable" as const;

/**
 * The account's status. Memoised per request (it runs on every signed-in
 * request), so one request never gets two different answers.
 *
 * Read from the app's own database connection first. When that is not
 * configured, or the query fails, the service-role client is asked instead, so
 * one failing connection does not sign everyone out. Only when neither can
 * answer is the result "unreadable".
 */
export const accountStatusFor = cache(async (userId: string): Promise<AccountStatusRead> => {
  const db = getDb();
  if (db) {
    try {
      const [row] = await db
        .select({ status: schema.profiles.accountStatus })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, userId))
        .limit(1);
      return (row?.status as AccountStatus | undefined) ?? null;
    } catch (error) {
      console.error("Account status read failed", error);
    }
  }

  const admin = getSupabaseAdmin();
  if (!admin) return STATUS_UNREADABLE;
  try {
    const { data, error } = await admin.from("profiles").select("account_status").eq("user_id", userId).maybeSingle();
    if (error) {
      console.error("Account status fallback read failed", { code: error.code, message: error.message });
      return STATUS_UNREADABLE;
    }
    return (data?.account_status as AccountStatus | undefined) ?? null;
  } catch (error) {
    console.error("Account status fallback read failed", error);
    return STATUS_UNREADABLE;
  }
});

/** Sets active ⇄ suspended. Only moves from the expected state, so a pending or deleted account is never touched. */
export async function setAccountSuspended(userId: string, suspended: boolean): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const from = suspended ? "active" : "suspended";
  try {
    const updated = await db
      .update(schema.profiles)
      .set({ accountStatus: suspended ? "suspended" : "active" })
      .where(and(eq(schema.profiles.userId, userId), eq(schema.profiles.accountStatus, from)))
      .returning({ userId: schema.profiles.userId });
    return updated.length === 1;
  } catch (error) {
    console.error("Account status update failed", error);
    return false;
  }
}

/**
 * Signs the account out everywhere by removing its Supabase sessions; their
 * refresh tokens go with them. The admin API can only sign out a session it
 * holds the access token for, so this is done in the database.
 */
export async function endAllSessions(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.execute(sql`delete from auth.sessions where user_id = ${userId}::uuid`);
    return true;
  } catch (error) {
    console.error("Ending sessions failed", error);
    return false;
  }
}
