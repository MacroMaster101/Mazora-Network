import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/types";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/session-cookie";
import { ensureUserProfile } from "@/lib/auth/profile";
import { dispatchSignInNotifications } from "@/lib/notifications-auto";
import { isRoleKey, landingPathFor, normalizeRoleKey } from "@/lib/auth/roles";
import { ensureRoleCatalog } from "@/lib/data/roles";
import { safeNext } from "@/lib/safe-redirect";
import { SUSPENDED_PATH } from "@/lib/auth/login-identifier";
import { resolvePublicOrigin } from "@/lib/site";
import { STATUS_UNREADABLE, accountStatusFor } from "@/lib/data/account-status";

/**
 * The origin used to build post-login redirects. In production this is the
 * configured public site URL, never the client-supplied x-forwarded-host /
 * x-forwarded-proto headers, which an attacker can set to redirect the OAuth
 * code exchange to an arbitrary host. Falls back to the request origin only in
 * non-production (local dev), where NEXT_PUBLIC_SITE_URL may be unset.
 */
function redirectOrigin(request: NextRequest): string {
  // Production must use the same hardened canonical-origin resolver as SEO,
  // Discord, and server actions. This rejects localhost, plain HTTP, www, the
  // Vercel preview host, paths, and malformed values instead of trusting a
  // copied or stale deployment variable for an OAuth redirect.
  if (process.env.NODE_ENV === "production") return resolvePublicOrigin();

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* misconfigured env — fall through to request origin */
    }
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const origin = redirectOrigin(request);
  // Google/Discord sign-in has no "Remember me" box: it stays signed in, so
  // any earlier "this browser session only" choice is dropped.
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  const supabase = await createSupabaseServerClient({ sessionOnly: false });

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const profile = await ensureUserProfile(data.user);
        // The status could not be read at all, so nothing says this account is
        // not suspended (a failed profile read above is null too, which the
        // check below would wave through). Same answer as loginAction: end the
        // new session and say sign-in is unavailable. It is not about this
        // account, so it does not wait for a two-step code.
        if ((await accountStatusFor(data.user.id)) === STATUS_UNREADABLE) {
          await supabase.auth.signOut({ scope: "local" });
          const unavailable = new URL("/login", origin);
          unavailable.searchParams.set("error", "auth_unavailable");
          if (next !== "/") unavailable.searchParams.set("next", next);
          return NextResponse.redirect(unavailable);
        }
        // Suspended from the Users board: end this new session at once and say
        // why, instead of landing on a page that quietly treats them as signed out.
        // With two-step verification on it waits for the code (/two-factor checks it).
        const hasFactor = data.user.factors?.some((factor) => factor.status === "verified") ?? false;
        if (profile?.account_status === "suspended" && !hasFactor) {
          await supabase.auth.signOut({ scope: "local" });
          return NextResponse.redirect(new URL(SUSPENDED_PATH, origin));
        }
        // Social sign-in is a sign-in like any other, so the fixed default
        // templates fire here too. Both dispatches are deduplicated and never
        // throw, so a failure cannot break the OAuth redirect.
        await dispatchSignInNotifications(data.user.id);
      }
      // No explicit destination → home, for every role. An explicit `next`
      // (e.g. account linking) wins.
      await ensureRoleCatalog();
      // normalizeRoleKey: legacy key read as web_dev until migration 055 (removable after).
      const raw = normalizeRoleKey(data.user?.app_metadata?.role);
      const role: Role = typeof raw === "string" && isRoleKey(raw) ? raw : "member";
      const dest = next && next !== "/" ? next : landingPathFor(role);
      // A fresh OAuth session is never past two-step verification, so an
      // account that has it on enters its code next (see getSession).
      const hasAuthenticator = data.user?.factors?.some((factor) => factor.status === "verified") ?? false;
      if (hasAuthenticator) {
        const twoFactor = new URL("/two-factor", origin);
        twoFactor.searchParams.set("next", dest);
        return NextResponse.redirect(twoFactor);
      }
      return NextResponse.redirect(new URL(dest, origin));
    }
  }

  const errorUrl = new URL(next, origin);
  errorUrl.searchParams.set("error", "oauth_failed");
  return NextResponse.redirect(errorUrl);
}
