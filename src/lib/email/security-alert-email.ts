/**
 * "A sign-in method was added to your account" — the email half of a security
 * alert (src/lib/security-alerts.ts). The notification bell gets the same news.
 *
 * Pure, like the welcome email beside it: wording and escaping are tested
 * directly. The device name is whatever the passkey or app was saved under,
 * which can be typed by whoever added it, so it is escaped and shortened.
 */

import { C, escapeHtml, greetingFor } from "./welcome-email";

export type SecurityAlertKind = "passkey" | "totp" | "webauthn" | "phone";

export interface SecurityAlertItem {
  kind: SecurityAlertKind;
  label: string | null;
  at: Date;
}

export interface SecurityAlertEmail {
  subject: string;
  html: string;
  text: string;
}

/** How each kind reads: a title for the bell, and the noun for a sentence. */
export const ALERT_COPY: Record<SecurityAlertKind, { title: string; noun: string }> = {
  passkey: { title: "Passkey added", noun: "A passkey" },
  totp: { title: "Authenticator app added", noun: "An authenticator app" },
  webauthn: { title: "Security key added", noun: "A security key" },
  phone: { title: "Phone added for sign-in codes", noun: "A phone number for sign-in codes" },
};

export function isSecurityAlertKind(value: string): value is SecurityAlertKind {
  return Object.hasOwn(ALERT_COPY, value);
}

/** The saved name, trimmed to something that fits on a line. */
export function alertLabel(label: string | null | undefined): string | null {
  const trimmed = (label ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > 60 ? `${trimmed.slice(0, 59)}…` : trimmed;
}

/** "Oct 6, 2026, 2:05 PM UTC": the server cannot know the reader's zone. */
export function alertTime(at: Date): string {
  return `${at.toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} UTC`;
}

/** One line per added method: "A passkey ("Windows Hello"), Oct 6, 2026, 2:05 PM UTC". */
function itemLine(item: SecurityAlertItem): string {
  const label = alertLabel(item.label);
  return `${ALERT_COPY[item.kind].noun}${label ? ` ("${label}")` : ""}, ${alertTime(item.at)}`;
}

export function buildSecurityAlertEmail(input: {
  name: string | null;
  origin: string;
  items: SecurityAlertItem[];
}): SecurityAlertEmail {
  const greeting = greetingFor(input.name);
  const origin = input.origin.replace(/\/+$/, "");
  const settingsUrl = `${origin}/dashboard/settings`;
  const items = input.items;
  const single = items.length === 1;

  const subject = single
    ? `${ALERT_COPY[items[0]!.kind].noun} was added to your Mazora account`
    : "New sign-in methods were added to your Mazora account";
  const lead = single
    ? "This was just added to your Mazora Network account:"
    : "These were just added to your Mazora Network account:";
  const ifNotYou =
    "If it wasn't you, open your security settings, remove it, then change your password; changing it signs every other device out. If you sign in without a password, contact staff through Discord support.";

  const text = [
    greeting,
    "",
    lead,
    "",
    ...items.map((item) => `• ${itemLine(item)}`),
    "",
    "If this was you, there is nothing to do.",
    "",
    ifNotYou,
    "",
    `Security settings: ${settingsUrl}`,
    "",
    "— The Mazora Network team",
    "",
    "You are receiving this because it is about the security of your account. It is sent for every new sign-in method.",
  ].join("\n");

  const rows = items
    .map(
      (item, index) =>
        `<tr><td style="padding:0 0 ${index === items.length - 1 ? "0" : "12px"};font-size:13px;color:${C.ink};"><strong>${escapeHtml(ALERT_COPY[item.kind].title)}</strong>${
          alertLabel(item.label) ? ` &middot; &ldquo;${escapeHtml(alertLabel(item.label)!)}&rdquo;` : ""
        }<br/><span style="color:${C.dim};font-size:12px;">${escapeHtml(alertTime(item.at))}</span></td></tr>`,
    )
    .join("");

  const html = `<div style="background:${C.page};padding:32px 12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<!--[if mso]>
<table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td>
<![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
    <tr>
      <td style="padding:32px 30px;">
        <div style="font-size:15px;font-weight:800;letter-spacing:1px;color:${C.ink};margin-bottom:22px;">MAZORA<span style="color:${C.purple};">NETWORK</span></div>
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${C.accent};text-transform:uppercase;margin-bottom:10px;">&mdash; Account security</div>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${C.ink};">${escapeHtml(single ? ALERT_COPY[items[0]!.kind].title : "New sign-in methods added")}</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${C.muted};">${escapeHtml(greeting)} ${escapeHtml(lead.charAt(0).toLowerCase() + lead.slice(1))}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;padding:18px 20px;background:${C.panel};border:1px solid ${C.line};border-radius:12px;">${rows}</table>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${C.muted};">If this was you, there is nothing to do.</p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${C.ink};"><strong>${escapeHtml(ifNotYou)}</strong></p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:10px;background:linear-gradient(115deg,${C.accent},${C.purple} 58%,#6F37E6);background-color:${C.purple};">
              <a href="${settingsUrl}" style="display:inline-block;padding:14px 30px;font-size:14px;font-weight:700;color:${C.panel};text-decoration:none;">
                Review security settings
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:${C.dim};">
          You are receiving this because it is about the security of your account. It is sent for every new sign-in method.
        </p>
      </td>
    </tr>
  </table>
<!--[if mso]>
</td></tr></table>
<![endif]-->
  <p style="max-width:560px;margin:18px auto 0;text-align:center;font-size:12px;color:${C.footer};">Mazora Network &middot; mazora.us</p>
</div>`;

  return { subject, html, text };
}
