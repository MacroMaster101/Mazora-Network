/**
 * "A sign-in method was added to your account" — the email half of a security
 * alert (src/lib/security-alerts.ts). The notification bell gets the same news.
 *
 * Pure, like the welcome email beside it: wording and escaping are tested
 * directly. The device name is whatever the passkey or app was saved under,
 * which can be typed by whoever added it, so it is escaped and shortened.
 */

import { supportEmail } from "@/lib/support-contact";
import { button, cleanOrigin, detailBox, detailRow, emailShell, escapeHtml, greetingFor, heading, paragraph, strong } from "./layout";

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

const REASON =
  "You are receiving this because it is about the security of your account. It is sent for every new sign-in method.";

export function buildSecurityAlertEmail(input: {
  name: string | null;
  origin: string;
  items: SecurityAlertItem[];
  /** Defaults to the configured public support address. */
  support?: string | null;
}): SecurityAlertEmail {
  const greeting = greetingFor(input.name);
  const origin = cleanOrigin(input.origin);
  const support = input.support === undefined ? supportEmail : input.support;
  const settingsUrl = `${origin}/dashboard/settings`;
  const items = input.items;
  const single = items.length === 1;

  const subject = single
    ? `${ALERT_COPY[items[0]!.kind].noun} was added to your Mazora account`
    : "New sign-in methods were added to your Mazora account";
  const lead = single
    ? "This was just added to your Mazora Network account:"
    : "These were just added to your Mazora Network account:";
  const whatToDo =
    "Open your security settings, remove it, then change your password; changing it signs every other device out. If you sign in without a password, contact staff through Discord support.";
  const ifNotYou = `If it wasn't you, ${whatToDo.charAt(0).toLowerCase()}${whatToDo.slice(1)}`;

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
    REASON,
    ...(support ? [`Questions? ${support}`] : []),
  ].join("\n");

  const rows = items
    .map((item, index) => {
      const label = alertLabel(item.label);
      const value = `${escapeHtml(alertTime(item.at))}${label ? ` &middot; &ldquo;${escapeHtml(label)}&rdquo;` : ""}`;
      return detailRow(escapeHtml(ALERT_COPY[item.kind].title), value, index === 0);
    })
    .join("");

  const body = [
    heading(escapeHtml(single ? ALERT_COPY[items[0]!.kind].title : "New sign-in methods added")),
    paragraph(`${escapeHtml(greeting)} ${escapeHtml(lead.charAt(0).toLowerCase() + lead.slice(1))}`),
    detailBox(rows),
    paragraph(`${strong("Was this you?")} Then there is nothing to do.`, "22px 0 0"),
    paragraph(`${strong("Wasn&rsquo;t you?")} ${escapeHtml(whatToDo)}`, "14px 0 24px"),
    button(settingsUrl, "Review security settings"),
  ].join("\n              ");

  const html = emailShell({
    title: subject,
    preheader: single
      ? `${ALERT_COPY[items[0]!.kind].noun} was just added to your Mazora Network account.`
      : "New sign-in methods were just added to your Mazora Network account.",
    origin,
    body,
    reason: REASON,
    support,
  });

  return { subject, html, text };
}
