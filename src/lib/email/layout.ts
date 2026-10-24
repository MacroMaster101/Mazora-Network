/**
 * The shared frame for every email the app sends through Resend.
 *
 * It is the same design as the Supabase auth email templates (edited in the
 * Supabase dashboard, under Authentication > Emails), so a member's sign-up code, password notices and the app's own welcome and
 * security emails all look like they came from one place: the logo, one card,
 * a light theme by default and a dark one where the mail client supports
 * `prefers-color-scheme` (Apple Mail, Outlook.com, most phones). Gmail ignores
 * the dark rules and shows the light version, which is why light is the
 * inline default rather than the override.
 *
 * Table-based, with the Outlook conditional wrapper: mail clients are not
 * browsers, and flex or float layouts collapse in Outlook.
 *
 * Pure: no transport or database import, so each email's wording and escaping
 * can be tested directly.
 */

/** Light colours, written inline. The dark ones live in the <style> block. */
export const C = {
  page: "#E8E4F0",
  card: "#F4F2F8",
  box: "#FFFFFF",
  line: "#CFC7DE",
  ink: "#1E172B",
  muted: "#544A66",
  dim: "#6B6080",
  accent: "#7C3AED",
  numBg: "#E9DDFF",
  button: "#7C3AED",
  buttonText: "#FFFFFF",
} as const;

/**
 * Escape for HTML.
 *
 * Display names come from a Google or Discord profile and device names are
 * typed by whoever added the device: text this project did not author. An
 * unescaped `<` would break the markup and, in a client that renders it,
 * could smuggle in a link.
 */
export function escapeHtml(value: string): string {
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

/** Trailing slashes would produce "//dashboard" in a link. */
export function cleanOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

const STYLE = `<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin: 0; padding: 0; }
  a { text-decoration: none; }
  img { border: 0; outline: none; }
  @media (prefers-color-scheme: dark) {
    .mz-page { background: #08060E !important; }
    .mz-card { background: #171123 !important; border-color: #302740 !important; }
    .mz-code { background: #0F0B18 !important; border-color: #3A2F4F !important; }
    .mz-ink { color: #F9F7FC !important; }
    .mz-muted { color: #B2A8C2 !important; }
    .mz-dim { color: #8F86A0 !important; }
    .mz-accent { color: #C49DFF !important; }
    .mz-num { background: #2B1F44 !important; color: #C49DFF !important; }
    .mz-logo-light { display: none !important; }
    .mz-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
  }
  [data-ogsc] .mz-ink { color: #F9F7FC !important; }
  [data-ogsc] .mz-muted { color: #B2A8C2 !important; }
  [data-ogsc] .mz-dim { color: #8F86A0 !important; }
  [data-ogsc] .mz-accent { color: #C49DFF !important; }
  [data-ogsb] .mz-page { background: #08060E !important; }
  [data-ogsb] .mz-card { background: #171123 !important; }
  [data-ogsb] .mz-code { background: #0F0B18 !important; }
  [data-ogsc] .mz-logo-light { display: none !important; }
  [data-ogsc] .mz-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
  @media screen and (max-width: 520px) {
    .mz-pad { padding: 26px 20px !important; }
  }
</style>`;

/** Heading at the top of the card. Pass escaped HTML. */
export function heading(html: string): string {
  return `<h1 class="mz-ink" style="margin:0 0 10px;font-size:24px;line-height:1.25;color:${C.ink};text-align:center;">${html}</h1>`;
}

/** Body copy inside the card. Pass escaped HTML. */
export function paragraph(html: string, margin = "0 0 20px"): string {
  return `<p class="mz-muted" style="margin:${margin};font-size:15px;line-height:1.6;color:${C.muted};text-align:center;">${html}</p>`;
}

/** Bold lead-in for a sentence, such as "Wasn't you?". Pass escaped HTML. */
export function strong(html: string): string {
  return `<strong class="mz-ink" style="color:${C.ink};">${html}</strong>`;
}

/** The bordered box that holds details: an account, a list of devices, steps. */
export function detailBox(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="mz-code" style="background:${C.box};border:1px solid ${C.line};border-radius:12px;padding:14px 18px;">${innerHtml}</td>
                </tr>
              </table>`;
}

/** One labelled line inside a detail box. Pass escaped HTML. */
export function detailRow(label: string, valueHtml: string, first: boolean): string {
  return `<p class="mz-dim" style="margin:${first ? "0" : "10px 0 0"};font-size:13px;line-height:1.7;color:${C.dim};">${label}<br><span class="mz-ink" style="color:${C.ink};font-weight:600;word-break:break-word;">${valueHtml}</span></p>`;
}

/** The single call to action, centred. `href` must already be safe. */
export function button(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:10px;background:${C.button};">
                    <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:${C.buttonText};border-radius:10px;text-align:center;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table></td></tr></table>`;
}

/** Small print under the card. Pass escaped HTML. */
function footnote(html: string, margin: string, size = 13): string {
  return `<p class="mz-dim" style="margin:${margin};font-size:${size}px;line-height:1.6;color:${C.dim};text-align:center;">${html}</p>`;
}

export function emailShell(input: {
  /** Shown as the page title, for clients that display it. Plain text. */
  title: string;
  /** The hidden preview line inbox lists show after the subject. Plain text. */
  preheader: string;
  origin: string;
  /** The card's contents, already escaped. */
  body: string;
  /** Why the recipient got this, shown under the card. Plain text. */
  reason: string;
  /** The public support address, or null to leave the line out. */
  support: string | null;
}): string {
  const origin = cleanOrigin(input.origin);
  const logo = (theme: "light" | "dark") =>
    `<img src="${escapeHtml(`${origin}/images/email/mazora-logo-${theme}.png`)}" width="210" height="66" alt="Mazora Network" style="display:block;margin:0 auto;width:210px;height:auto;">`;
  const support = input.support
    ? footnote(
        `Questions? <a href="mailto:${escapeHtml(input.support)}" class="mz-accent" style="color:${C.accent};font-weight:600;">${escapeHtml(input.support)}</a>`,
        "0 0 8px",
      )
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
${STYLE}
</head>
<body class="mz-page" style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mz-page" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:32px 12px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
        <!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td align="center" style="padding:0 0 22px;"><span class="mz-logo-light">${logo("light")}</span>
              <!--[if !mso]><!--><div class="mz-logo-dark" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${logo("dark")}</div><!--<![endif]--></td></tr>
          <tr>
            <td class="mz-card mz-pad" style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:34px 32px;">
              ${input.body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 6px 0;">
              ${footnote(escapeHtml(input.reason), "0 0 8px")}
              ${support}
              ${footnote("Mazora Network &middot; mazora.us", "0", 12)}
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
