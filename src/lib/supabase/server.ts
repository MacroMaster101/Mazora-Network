import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { SESSION_ONLY_COOKIE, applySessionLength } from "./session-cookie";

/**
 * `sessionOnly` overrides the "Remember me" marker for this client: the login
 * action passes the checkbox's answer directly, because the marker it sets in
 * the same request is not guaranteed to be readable back yet. Every other
 * caller omits it and follows the marker.
 */
export async function createSupabaseServerClient({ sessionOnly }: { sessionOnly?: boolean } = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    /*
      @supabase/ssr defaults to httpOnly: false so that a *browser* Supabase
      client can read the session from document.cookie. This app has no
      browser client — every Supabase call goes through server code — so the
      auth cookie (access + refresh token) has no reason to be scriptable.
      httpOnly keeps a future XSS or rogue extension from exfiltrating a
      long-lived session.
    */
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        // "Remember me" unticked: keep the auth cookies to this browser session.
        const shortLived = sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applySessionLength(value, options, shortLived)),
          );
        } catch {
          // Server Components cannot write cookies. Middleware refreshes them.
        }
      },
    },
  });
}
