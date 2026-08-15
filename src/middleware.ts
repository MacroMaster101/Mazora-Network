import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getLaunchGate, isLaunchModeEnabled } from "@/lib/launch";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/csp";

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
function withCsp(request: NextRequest, nonce: string, csp: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return { response, requestHeaders };
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce, isDev);

  const hasSupabaseAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
  const hasSessionCookie = request.cookies.has("mz_session") || hasSupabaseAuthCookie;
  const launchGate = isLaunchModeEnabled() ? getLaunchGate(request.nextUrl.pathname) : undefined;
  if (launchGate && (!request.nextUrl.pathname.startsWith("/dashboard") || hasSessionCookie)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/launch-status";
    destination.searchParams.set("from", request.nextUrl.pathname);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
    const rewrite = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
    rewrite.headers.set("Content-Security-Policy", csp);
    return rewrite;
  }

  const config = getSupabaseConfig();
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));

  if (!config || !hasAuthCookie || request.nextUrl.pathname.startsWith("/auth/")) {
    return withCsp(request, nonce, csp).response;
  }

  const { response: initial, requestHeaders } = withCsp(request, nonce, csp);
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
        response.headers.set("Content-Security-Policy", csp);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
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
    response.headers.set("Content-Security-Policy", csp);
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
