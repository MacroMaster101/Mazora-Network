import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/auth/profile";
import { landingPathFor, ROLES } from "@/lib/auth/roles";
import { safeNext } from "@/lib/safe-redirect";

/**
 * The origin used to build post-login redirects. In production this is the
 * configured public site URL, never the client-supplied x-forwarded-host /
 * x-forwarded-proto headers, which an attacker can set to redirect the OAuth
 * code exchange to an arbitrary host. Falls back to the request origin only in
 * non-production (local dev), where NEXT_PUBLIC_SITE_URL may be unset.
 */
function redirectOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* misconfigured env — fall through to request origin */
    }
  }
  if (process.env.NODE_ENV === "production") {
    // No trusted origin available: use the server's own origin, not any
    // forwarded header, so a crafted host cannot hijack the redirect.
    return request.nextUrl.origin;
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
      if (data.user) await ensureUserProfile(data.user);
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
