/**
 * The welcome email sent once, on a member's first sign-in.
 *
 * Pure: takes a name and an origin, returns the message. Kept free of any
 * transport or database import so the wording and escaping can be tested
 * directly, the same split the presence and store-message templates use.
 *
 * The layout mirrors the Supabase confirmation template so the two emails a
 * member receives look like they came from the same place. Table-based with
 * the Outlook conditional wrapper for the same reason that one is: mail
 * clients are not browsers, and float/flex layouts collapse in Outlook.
 *
 * Deliberately carries no Supabase `{{ .Token }}`-style variables. Those are
 * expanded by Supabase's own mailer; this message is sent by the app through
 * Resend, where they would arrive as literal text.
 */

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

/** Brand palette, matching the confirmation template. */
const C = {
  page: "#08060E",
  panel: "#0F0B18",
  card: "#171123",
  line: "#302740",
  ink: "#F9F7FC",
  muted: "#B2A8C2",
  dim: "#7A7188",
  accent: "#C49DFF",
  purple: "#8B5CF6",
  footer: "#5B516C",
} as const;

/**
 * Escape for HTML.
 *
 * The display name comes from a Google or Discord profile, so it is text this
 * project did not author. An unescaped `<` there would break the markup and,
 * in a mail client that renders it, could smuggle in a link.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A greeting that reads properly whether or not we know their name. */
export function greetingFor(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? `Hi ${trimmed},` : "Hi there,";
}

/** The three things a new member most likely wants to do first. */
const NEXT_STEPS: ReadonlyArray<[title: string, detail: string]> = [
  ["Link your Minecraft name", "Rank and stats follow you in game"],
  ["Browse the store", "Ranks, keys and cosmetics"],
  ["Open a support ticket", "The team replies in Discord"],
];

export function buildWelcomeEmail(input: { name: string | null; origin: string }): WelcomeEmail {
  const greeting = greetingFor(input.name);
  // Trailing slashes would produce "//dashboard" in the link.
  const origin = input.origin.replace(/\/+$/, "");

  const text = [
    greeting,
    "",
    "Welcome to Mazora Network — your account is ready.",
    "",
    ...NEXT_STEPS.map(([title, detail]) => `• ${title} — ${detail}`),
    "",
    `Open your dashboard: ${origin}/dashboard`,
    "",
    "See you on the server.",
    "— The Mazora Network team",
    "",
    "You are receiving this because an account was created with this email address.",
  ].join("\n");

  const heroRows = [
    ["Java + Bedrock", "One connected profile"],
    ["Player-first", "Fair and secure by design"],
    ["Community ready", "Forums, events, and teams"],
  ]
    .map(
      ([title, sub], index, all) =>
        `<tr><td style="padding:0 0 ${index === all.length - 1 ? "0" : "12px"};font-size:12px;color:${C.ink};"><strong>${title}</strong><br/><span style="color:${C.dim};font-size:11px;">${sub}</span></td></tr>`,
    )
    .join("");

  const stepRows = NEXT_STEPS.map(
    ([title, detail], index) =>
      `<tr><td style="padding:0 0 ${index === NEXT_STEPS.length - 1 ? "0" : "14px"};font-size:13px;color:${C.ink};"><strong>${escapeHtml(title)}</strong><br/><span style="color:${C.dim};font-size:12px;">${escapeHtml(detail)}</span></td></tr>`,
  ).join("");

  const html = `<div style="background:${C.page};padding:32px 12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<!--[if mso]>
<table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td>
<![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${C.panel};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
    <tr>
      <td class="hero-col" width="240" valign="top" style="background:${C.panel};padding:32px 26px;border-right:1px solid ${C.line};">
        <div style="font-size:15px;font-weight:800;letter-spacing:1px;color:${C.ink};margin-bottom:22px;">MAZORA<span style="color:${C.purple};">NETWORK</span></div>
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${C.accent};text-transform:uppercase;margin-bottom:10px;">&mdash; Mazora Player Network</div>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:${C.ink};">One account.<br/>Every world.</h1>
        <p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:${C.muted};">
          Keep your progress, community identity, event entries, and support history together wherever you play.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${heroRows}</table>
      </td>
      <td class="card-col" valign="top" style="background:${C.card};padding:36px 30px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${C.accent};text-transform:uppercase;margin-bottom:10px;">&mdash; You&rsquo;re in</div>
        <h2 style="margin:0 0 12px;font-size:22px;color:${C.ink};">Welcome to Mazora</h2>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:${C.muted};">
          ${escapeHtml(greeting)} your account is ready. Here is where to start:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;padding:18px 20px;background:${C.panel};border:1px solid ${C.line};border-radius:12px;">${stepRows}</table>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:10px;background:linear-gradient(115deg,${C.accent},${C.purple} 58%,#6F37E6);background-color:${C.purple};">
              <a href="${origin}/dashboard" style="display:inline-block;padding:14px 30px;font-size:14px;font-weight:700;color:${C.panel};text-decoration:none;">
                Open your dashboard
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:${C.dim};">
          You are receiving this because an account was created with this email address.
        </p>
      </td>
    </tr>
  </table>
<!--[if mso]>
</td></tr></table>
<![endif]-->
  <p style="max-width:600px;margin:18px auto 0;text-align:center;font-size:12px;color:${C.footer};">Mazora Network &middot; mazora.us</p>
</div>

<style>
  @media screen and (max-width: 560px) {
    .hero-col, .card-col { display: block !important; width: 100% !important; border-right: none !important; }
    .hero-col { border-bottom: 1px solid ${C.line}; }
  }
</style>`;

  return { subject: "Welcome to Mazora Network", html, text };
}
