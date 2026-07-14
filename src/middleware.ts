import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getLaunchGate, isLaunchModeEnabled } from "@/lib/launch";

export async function middleware(request: NextRequest) {
  const hasSupabaseAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
  const hasSessionCookie = request.cookies.has("mz_session") || hasSupabaseAuthCookie;
  const launchGate = isLaunchModeEnabled() ? getLaunchGate(request.nextUrl.pathname) : undefined;
  if (launchGate && (!request.nextUrl.pathname.startsWith("/dashboard") || hasSessionCookie)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/launch-status";
    destination.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.rewrite(destination);
  }

  const config = getSupabaseConfig();
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));

  if (!config || !hasAuthCookie || request.nextUrl.pathname.startsWith("/auth/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
