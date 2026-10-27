/**
 * "A sign-in method was added to your account" — the email half of a security
 * alert (src/lib/security-alerts.ts). The notification bell gets the same news.
 *
 * Pure, like the welcome email beside it: wording and escaping are tested
 * directly. The device name is whatever the passkey or app was saved under,
 * which can be typed by whoever added it, so it is escaped and shortened.
 */

import { supportEmail } from "@/lib/support-contact";
import { validTimeZone } from "@/lib/time-zone";
import { providerName } from "@/lib/auth/linked-logins-core";
import { button, cleanOrigin, detailBox, detailRow, emailShell, escapeHtml, greetingFor, heading, paragraph, strong } from "./layout";

export type SecurityAlertKind = "passkey" | "totp" | "webauthn" | "phone" | "google" | "discord" | "identity";

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
  // A provider login linked to the account (migration 085), labelled with its address.
  google: { title: "Google login connected", noun: "A Google login" },
  discord: { title: "Discord login connected", noun: "A Discord login" },
  identity: { title: "Login connected", noun: "A provider login" },
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

/**
 * "Oct 6, 2026, 7:35 PM GMT+5:30" in the member's saved zone, or
 * "Oct 6, 2026, 2:05 PM UTC" when none is saved (see lib/time-zone).
 */
export function alertTime(at: Date, timeZone?: string | null): string {
  return at.toLocaleString("en-US", {
    timeZone: validTimeZone(timeZone) ?? "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** One line per added method: "A passkey ("Windows Hello"), Oct 6, 2026, 2:05 PM UTC". */
function itemLine(item: SecurityAlertItem, timeZone: string | null | undefined): string {
  const label = alertLabel(item.label);
  return `${ALERT_COPY[item.kind].noun}${label ? ` ("${label}")` : ""}, ${alertTime(item.at, timeZone)}`;
}

const REASON =
  "You are receiving this because it is about the security of your account. It is sent for every new sign-in method.";

export function buildSecurityAlertEmail(input: {
  name: string | null;
  origin: string;
  items: SecurityAlertItem[];
  /** The member's saved time zone; UTC when missing. */
  timeZone?: string | null;
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
    ...items.map((item) => `• ${itemLine(item, input.timeZone)}`),
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
      const value = `${escapeHtml(alertTime(item.at, input.timeZone))}${label ? ` &middot; &ldquo;${escapeHtml(label)}&rdquo;` : ""}`;
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

const REMOVED_REASON =
  "You are receiving this because it is about the security of your account. It is sent whenever the site removes a login it did not add.";

/**
 * "We removed a Google login we didn't recognise" — a provider login was
 * linked to the account without going through the site (lib/auth/linked-logins),
 * so it was removed and every device signed out. Nothing here is typed by the
 * member; the provider names come from a fixed list.
 */
export function buildLinkedLoginRemovedEmail(input: {
  name: string | null;
  origin: string;
  providers: string[];
  at: Date;
  timeZone?: string | null;
  support?: string | null;
}): SecurityAlertEmail {
  const greeting = greetingFor(input.name);
  const origin = cleanOrigin(input.origin);
  const support = input.support === undefined ? supportEmail : input.support;
  const settingsUrl = `${origin}/dashboard/settings`;
  const names = input.providers.map(providerName);
  const several = names.length > 1;
  const what = names.length ? `${names.join(" and ")} login${several ? "s" : ""}` : "login";
  const subject = `We removed ${several ? "" : "a "}${what} from your Mazora account`;
  const lead = several
    ? `${what} were connected to your Mazora Network account without going through the site, so we removed them and signed your account out on every device.`
    : `A ${what} was connected to your Mazora Network account without going through the site, so we removed it and signed your account out on every device.`;
  const advice =
    "Someone may have a copy of a signed-in session. Sign in again, change your password, and check your passkeys and two-step verification in your security settings.";

  const text = [
    greeting,
    "",
    lead,
    "",
    `When: ${alertTime(input.at, input.timeZone)}`,
    "",
    advice,
    "",
    `Security settings: ${settingsUrl}`,
    "",
    "— The Mazora Network team",
    "",
    REMOVED_REASON,
    ...(support ? [`Questions? ${support}`] : []),
  ].join("\n");

  const body = [
    heading(escapeHtml(`Unrecognised ${what} removed`)),
    // Own paragraph: the lead may start with a provider's name, which stays capitalised.
    paragraph(escapeHtml(greeting), "0 0 8px"),
    paragraph(escapeHtml(lead)),
    detailBox(detailRow("When", escapeHtml(alertTime(input.at, input.timeZone)), true)),
    paragraph(`${strong("What to do")} ${escapeHtml(advice)}`, "22px 0 24px"),
    button(settingsUrl, "Review security settings"),
  ].join("\n              ");

  const html = emailShell({ title: subject, preheader: lead, origin, body, reason: REMOVED_REASON, support });
  return { subject, html, text };
}

const EMAIL_CODE_REASON =
  "You are receiving this because it is about the security of your account. It is sent every time an email code is used to sign in.";

/**
 * "You signed in with an email code" — sent every time one finishes a sign-in.
 * Email codes are on by default, so this is how a member notices someone else
 * who got into their inbox and knew their password.
 */
export function buildEmailCodeSignInEmail(input: {
  name: string | null;
  origin: string;
  at: Date;
  /** The member's saved time zone; UTC when missing. */
  timeZone?: string | null;
  /** Defaults to the configured public support address. */
  support?: string | null;
}): SecurityAlertEmail {
  const greeting = greetingFor(input.name);
  const origin = cleanOrigin(input.origin);
  const support = input.support === undefined ? supportEmail : input.support;
  const settingsUrl = `${origin}/dashboard/settings`;
  const subject = "You signed in to Mazora with an email code";
  const whatToDo =
    "Change your password and your email account's password, then turn off email codes in your security settings.";

  const text = [
    greeting,
    "",
    `An email code was just used to finish signing in to your Mazora Network account (${alertTime(input.at, input.timeZone)}).`,
    "",
    "If this was you, there is nothing to do.",
    "",
    `If it wasn't you, ${whatToDo.charAt(0).toLowerCase()}${whatToDo.slice(1)}`,
    "",
    `Security settings: ${settingsUrl}`,
    "",
    "— The Mazora Network team",
    "",
    EMAIL_CODE_REASON,
    ...(support ? [`Questions? ${support}`] : []),
  ].join("\n");

  const body = [
    heading("Signed in with an email code"),
    paragraph(`${escapeHtml(greeting)} an email code was just used to finish signing in to your Mazora Network account.`),
    detailBox(detailRow("Time", escapeHtml(alertTime(input.at, input.timeZone)), true)),
    paragraph(`${strong("Was this you?")} Then there is nothing to do.`, "22px 0 0"),
    paragraph(`${strong("Wasn&rsquo;t you?")} ${escapeHtml(whatToDo)}`, "14px 0 24px"),
    button(settingsUrl, "Review security settings"),
  ].join("\n              ");

  const html = emailShell({
    title: subject,
    preheader: "An email code was just used to sign in to your Mazora Network account.",
    origin,
    body,
    reason: EMAIL_CODE_REASON,
    support,
  });

  return { subject, html, text };
}
