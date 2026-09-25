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
import { resolvePublicOrigin } from "@/lib/site";

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
        await ensureUserProfile(data.user);
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
