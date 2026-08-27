import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/auth/profile";
import { dispatchSignInNotifications } from "@/lib/notifications-auto";
import { landingPathFor, ROLES } from "@/lib/auth/roles";
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
  const supabase = await createSupabaseServerClient();

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
      // No explicit destination → route by role (staff → their dashboard,
      // everyone else → home). An explicit `next` (e.g. account linking) wins.
      const raw = data.user?.app_metadata?.role;
      const role: Role = typeof raw === "string" && ROLES.includes(raw as Role) ? (raw as Role) : "member";
      const dest = next && next !== "/" ? next : landingPathFor(role);
      return NextResponse.redirect(new URL(dest, origin));
    }
  }

  const errorUrl = new URL(next, origin);
  errorUrl.searchParams.set("error", "oauth_failed");
  return NextResponse.redirect(errorUrl);
}
