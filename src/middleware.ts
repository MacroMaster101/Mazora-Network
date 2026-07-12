import { NextResponse, type NextRequest } from "next/server";

/**
 * Route protection based on the Phase-1 session cookie. This is a convenience
 * gate for navigation; real authorization is enforced server-side in each
 * protected page/layout via getSession()/requireRole (and moves to Supabase
 * Auth in Phase 2). We only read cookie presence here — never trust it as the
 * sole security boundary.
 */
const SESSION_COOKIE = "mz_session";

function readRole(request: NextRequest): string | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof json?.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

const ADMIN_ROLES = new Set(["administrator", "owner"]);
const STAFF_ROLES = new Set(["staff", "moderator", "administrator", "owner"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = readRole(request);

  const needsAuth =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/staff/");

  if (needsAuth && !role) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && (!role || !ADMIN_ROLES.has(role))) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    return NextResponse.redirect(dash);
  }

  if (pathname.startsWith("/staff/") && (!role || !STAFF_ROLES.has(role))) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    return NextResponse.redirect(dash);
  }

  if (role && (pathname === "/login" || pathname === "/register")) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    return NextResponse.redirect(dash);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/staff/:path*", "/login", "/register"],
};
