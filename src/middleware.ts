import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getLaunchGate, isLaunchModeEnabled } from "@/lib/launch";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/csp";
import { EDITABLE_PAGE_PATHS } from "@/lib/page-paths";
import { isScannerProbe } from "@/lib/scanner-probe";
import { SESSION_ONLY_COOKIE, applySessionLength } from "@/lib/supabase/session-cookie";

const isDev = process.env.NODE_ENV === "development";

const DEAD_SESSION_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_expired",
]);

function isDeadSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && DEAD_SESSION_CODES.has(code);
}

/**
 * Every response out of this file must carry the CSP, and the nonce must reach
 * the render pass. Next reads the nonce off the *request* `content-security-policy`
 * header to stamp its own bootstrap scripts, and `x-nonce` is what the root
 * layout reads for the inline theme script.
 */
function setResponseSecurityHeaders(response: NextResponse, csp: string, allowSameOriginFrame: boolean) {
  response.headers.set("Content-Security-Policy", csp);
  if (allowSameOriginFrame) response.headers.set("X-Frame-Options", "SAMEORIGIN");
}

function withCsp(request: NextRequest, nonce: string, csp: string, allowSameOriginFrame = false) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  setResponseSecurityHeaders(response, csp, allowSameOriginFrame);
  return { response, requestHeaders };
}

export async function middleware(request: NextRequest) {
  // Scanner probes (/wp-admin/install.php, /.git/config…) end here, at the
  // edge, instead of costing a not-found page render in a function.
  if (isScannerProbe(request.nextUrl.pathname)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }

  const nonce = generateNonce();
  const hasSupabaseAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
  const hasSessionCookie = request.cookies.has("mz_session") || hasSupabaseAuthCookie;
  /*
    The page editor frames the live page it edits, so those responses — and only
    those — may be framed same-origin.

    Middleware cannot tell staff from any other signed-in visitor: the role
    lives in the database, and `mz_session` is demo-mode only. So the check that
    carries the weight is the request's own fetch metadata. The editor's preview
    arrives as a same-origin iframe subrequest; a clickjacking attempt from
    another origin arrives as `Sec-Fetch-Site: cross-site`, never matches, and
    is served `frame-ancestors 'none'` as before. The browser sets these headers
    and page script cannot forge them, which is what makes them worth trusting
    here — unlike the cookie, which only proves someone is signed in.

    A browser too old to send Sec-Fetch (Safari before 16.4) simply keeps the
    strict policy and loses the inline preview; "View live page" still works.
    That is the right way round to fail.
  */
  const isSameOriginFrame =
    request.headers.get("sec-fetch-dest") === "iframe" &&
    request.headers.get("sec-fetch-site") === "same-origin";
  const isAdminPagePreview =
    request.nextUrl.searchParams.get("adminPreview") === "1" &&
    hasSessionCookie &&
    isSameOriginFrame &&
    EDITABLE_PAGE_PATHS.has(request.nextUrl.pathname);
  const isPageEditor = request.nextUrl.pathname.startsWith("/admin/pages/");
  const csp = buildContentSecurityPolicy(nonce, isDev, {
    allowSameOriginFrameAncestors: isAdminPagePreview,
    allowSameOriginFrameSources: isPageEditor,
  });

  const launchGate = isLaunchModeEnabled() ? getLaunchGate(request.nextUrl.pathname) : undefined;
  if (launchGate && (!request.nextUrl.pathname.startsWith("/dashboard") || hasSessionCookie)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/launch-status";
    destination.searchParams.set("from", request.nextUrl.pathname);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
    const rewrite = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
    setResponseSecurityHeaders(rewrite, csp, isAdminPagePreview);
    return rewrite;
  }

  const config = getSupabaseConfig();
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));

  if (!config || !hasAuthCookie || request.nextUrl.pathname.startsWith("/auth/")) {
    return withCsp(request, nonce, csp, isAdminPagePreview).response;
  }

  const { response: initial, requestHeaders } = withCsp(request, nonce, csp, isAdminPagePreview);
  let response = initial;
  const supabase = createServerClient(config.url, config.key, {
    /*
      Must match src/lib/supabase/server.ts: no browser Supabase client exists,
      so the refreshed auth cookie is httpOnly (see the comment there).
    */
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // requestHeaders was cloned before Supabase refreshed the cookie. Keep
        // the forwarded render request in sync, otherwise the Server Component
        // immediately retries the expired token that middleware just replaced.
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = NextResponse.next({ request: { headers: requestHeaders } });
        setResponseSecurityHeaders(response, csp, isAdminPagePreview);
        // "Remember me" unticked: refreshed auth cookies stay browser-session only.
        const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applySessionLength(value, options, sessionOnly)),
        );
      },
    },
  });

  const { error } = await supabase.auth.getClaims();
  if (isDeadSessionError(error)) {
    const deadCookies = request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));

    for (const { name } of deadCookies) request.cookies.delete(name);
    requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
    response = NextResponse.next({ request: { headers: requestHeaders } });
    setResponseSecurityHeaders(response, csp, isAdminPagePreview);
    for (const { name } of deadCookies) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
