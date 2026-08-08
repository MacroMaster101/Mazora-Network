/**
 * Content Security Policy, built per request so production can carry a nonce
 * instead of `script-src 'unsafe-inline'`.
 *
 * Why this lives in middleware rather than next.config headers(): a nonce has
 * to be fresh per response and has to be readable by the app when it renders
 * the inline theme script. Static headers cannot do either.
 *
 * Remaining relaxations, deliberately:
 *  - `style-src 'unsafe-inline'` stays. Next injects inline styles during
 *    hydration and Tailwind arbitrary values compile to inline style attributes.
 *    Inline *style* is a far weaker vector than inline *script* — it cannot
 *    execute JS — so this is the accepted trade.
 *  - Development keeps 'unsafe-inline' and 'unsafe-eval': `next dev` evaluates
 *    client modules through eval() and React Refresh injects unnonced inline
 *    scripts. Without them nothing hydrates. Production never evals.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

let supabaseImageOrigin = "";
if (supabaseUrl) {
  try {
    supabaseImageOrigin = new URL(supabaseUrl).origin;
  } catch {
    // Invalid values are surfaced by the Supabase config module.
  }
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  // 'strict-dynamic' lets the nonced Next bootstrap load its own chunks without
  // each one needing a nonce. CSP3 browsers ignore host allowlists in
  // script-src once it is present, which is the intent — only scripts this page
  // vouches for run.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    // Avatar sources, and they must stay in step with the provider allowlist in
    // lib/data/accounts.ts: a host trusted there but missing here is silently
    // blocked by the browser, which reads as "that member has no photo" rather
    // than as an error. googleusercontent is where Google account photos live.
    `img-src 'self' data: blob: https://mc-heads.net https://api.dicebear.com https://cdn.discordapp.com https://*.googleusercontent.com${supabaseImageOrigin ? ` ${supabaseImageOrigin}` : ""}`,
    "font-src 'self'",
    // https: covers the env-configured Supabase host without hard-coding it.
    // ws: is dev-only, for the hot-reload socket.
    `connect-src 'self' https:${isDev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Only the Discord server widget embedded on /discord.
    "frame-src https://discord.com",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** 128 bits of randomness, base64 — regenerated for every document response. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
