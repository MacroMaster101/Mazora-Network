/**
 * "Remember me", for Supabase's auth cookies.
 *
 * Unticked, a sign-in should end when the browser closes. Supabase writes its
 * auth cookies with a long Max-Age and rewrites them on every token refresh,
 * so the choice cannot be made once at login: this marker cookie — itself a
 * browser-session cookie — records it, and every place that writes the auth
 * cookies (lib/supabase/server.ts and middleware.ts) runs them through
 * `applySessionLength`, which strips the expiry while the marker is present.
 *
 * Deletions keep their expiry: a cookie cleared with Max-Age=0 must still be
 * cleared, or signing out would leave the session behind.
 *
 * Plain constants and a pure function, so the Edge middleware can import it.
 */

export const SESSION_ONLY_COOKIE = "mz_session_only";

export interface CookieWriteOptions {
  maxAge?: number;
  expires?: Date | number | string;
  [key: string]: unknown;
}

export function applySessionLength<T extends CookieWriteOptions | undefined>(
  value: string,
  options: T,
  sessionOnly: boolean,
): T {
  if (!sessionOnly || !options) return options;
  const deleting = value === "" || options.maxAge === 0;
  if (deleting) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest as T;
}

/** The marker's own options: httpOnly and, deliberately, no Max-Age. */
export function sessionOnlyMarkerOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
