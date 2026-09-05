/**
 * What the account's Security card is allowed to claim.
 *
 * The card used to read "Active session encrypted and protected with secure
 * identity verification" — words that described nothing and were true of any
 * account in any state. Everything here is derived from the session and the
 * user record instead.
 *
 * DELIBERATELY ABSENT: a devices or locations list. Supabase auth is called
 * from this app's server, so Supabase records the SERVER as the client —
 * `auth.sessions.user_agent` reads "Vercel Edge Functions" or "Next.js
 * Middleware" and `ip` holds the Vercel function's address, never the member's.
 * See the same finding recorded in notifications-auto.ts. A device list built
 * on that data would be confidently wrong, which is worse than the vague copy
 * it replaced.
 *
 * Pure so the derivation can be tested without a session.
 */

export type SignInMethod = "password" | "google" | "discord" | "magic-link" | "unknown";

/** Human label for the method a session was established with. */
export function methodLabel(method: SignInMethod): string {
  switch (method) {
    case "password":
      return "Email and password";
    case "google":
      return "Google";
    case "discord":
      return "Discord";
    case "magic-link":
      return "Email link";
    default:
      return "Unknown";
  }
}

/**
 * The method that established THIS session.
 *
 * `amr` (Authentication Methods References) is the authoritative per-session
 * record — the same values Supabase writes to auth.mfa_amr_claims. It reports
 * `oauth` without naming the provider, so the account's own provider fills
 * that in; an account with both Google and Discord linked can only be narrowed
 * that far, and saying "Google or Discord" would be less useful than naming
 * the one the account was created with.
 */
export function currentSignInMethod(
  amr: Array<{ method?: string }> | null | undefined,
  provider: string | null | undefined,
): SignInMethod {
  const methods = (amr ?? []).map((entry) => entry?.method).filter(Boolean) as string[];

  if (methods.includes("password")) return "password";
  if (methods.includes("otp") || methods.includes("magiclink")) return "magic-link";

  if (methods.includes("oauth") || !methods.length) {
    if (provider === "google") return "google";
    if (provider === "discord") return "discord";
    if (provider === "email") return "password";
  }
  return "unknown";
}

/** Every way this account can be signed into, for the "methods" row. */
export function linkedMethods(input: {
  providers: string[] | null | undefined;
  hasPassword: boolean;
}): SignInMethod[] {
  const out: SignInMethod[] = [];
  for (const provider of input.providers ?? []) {
    if (provider === "google") out.push("google");
    if (provider === "discord") out.push("discord");
  }
  if (input.hasPassword) out.push("password");
  return out;
}

export interface SecurityState {
  current: SignInMethod;
  methods: SignInMethod[];
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  /**
   * True when the only way in is an OAuth provider.
   *
   * Worth surfacing: if that provider is ever lost, so is the account. It is
   * the one thing on this card a member can act on.
   */
  oauthOnly: boolean;
}

export function buildSecurityState(input: {
  amr: Array<{ method?: string }> | null | undefined;
  provider: string | null | undefined;
  providers: string[] | null | undefined;
  hasPassword: boolean;
  emailConfirmedAt: string | null | undefined;
  lastSignInAt: string | null | undefined;
}): SecurityState {
  const methods = linkedMethods({ providers: input.providers, hasPassword: input.hasPassword });
  return {
    current: currentSignInMethod(input.amr, input.provider),
    methods,
    emailConfirmed: Boolean(input.emailConfirmedAt),
    lastSignInAt: input.lastSignInAt ?? null,
    oauthOnly: !input.hasPassword && methods.length > 0,
  };
}

/**
 * Read `amr` out of a Supabase access token.
 *
 * The signature is NOT verified here on purpose: this token came back from the
 * Supabase client's own authenticated call in the same request, and the value
 * is used only to choose a label on screen. Nothing is authorised by it.
 */
export function amrFromAccessToken(accessToken: string | null | undefined): Array<{ method?: string }> {
  if (!accessToken) return [];
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return [];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { amr?: Array<{ method?: string }> };
    return Array.isArray(claims.amr) ? claims.amr : [];
  } catch {
    // A malformed token is not worth an error path — the provider fallback
    // still produces a correct label.
    return [];
  }
}
