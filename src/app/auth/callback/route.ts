import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Restricts the post-login redirect target to a same-origin path. Checking
 * only for a leading "//" is not enough: browsers strip ASCII tab/CR/LF
 * anywhere in a URL and treat a backslash the same as a forward slash before
 * resolving it (WHATWG URL spec), so "/\evil.com" or "/\t/evil.com" both
 * look like safe same-origin paths to a naive check but actually resolve to
 * "https://evil.com" once new URL(next, origin) below is followed by the
 * browser. Normalizing the same way before checking closes that bypass.
 */
function safeNext(value: string | null): string {
  if (!value) return "/";
  const normalized = value.replace(/[\t\r\n]/g, "").replace(/\\/g, "/");
  return normalized.startsWith("/") && !normalized.startsWith("//") ? normalized : "/";
}

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
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const errorUrl = new URL(next, origin);
  errorUrl.searchParams.set("error", "oauth_failed");
  return NextResponse.redirect(errorUrl);
}
