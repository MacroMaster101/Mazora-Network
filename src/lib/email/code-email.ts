/**
 * The six-digit code emails: signing in with an email code, confirming an
 * account change, and confirming account deletion. Same branded layout as the
 * welcome and security-alert emails beside it.
 *
 * Pure, so wording and escaping are tested directly.
 */

import { C, cleanOrigin, detailBox, emailShell, escapeHtml, heading, paragraph, strong } from "./layout";

export type CodeEmailPurpose = "account-deletion" | "account-change" | "two-factor-sign-in";

export interface CodeEmail {
  subject: string;
  html: string;
  text: string;
}

const COPY: Record<CodeEmailPurpose, { subject: string; heading: string; lead: string; scope: string; notYou: string }> = {
  "two-factor-sign-in": {
    subject: "Your Mazora sign-in verification code",
    heading: "Your sign-in code",
    lead: "Enter this code to finish signing in to your Mazora Network account.",
    scope: "It expires in 10 minutes and works once, only in the browser that asked for it.",
    notYou: "Someone else may be trying to get into your account. Don't share this code, and change your password.",
  },
  "account-change": {
    subject: "Confirm it's you",
    heading: "Confirm it's you",
    lead: "Enter this code to add a passkey, set a password, turn on two-step verification or connect a sign-in account.",
    scope: "It expires in 10 minutes and works only in the browser that asked for it.",
    notYou: "Don't share or enter this code, and sign out of devices you don't recognise.",
  },
  "account-deletion": {
    subject: "Confirm your account deletion",
    heading: "Confirm account deletion",
    lead: "Enter this code to permanently delete your Mazora Network account.",
    scope: "It expires in 10 minutes and works only in the browser that asked for it. Deleting your account can't be undone.",
    notYou: "Don't share or enter this code. Your account stays as it is.",
  },
};

const REASON = "You are receiving this because a code was requested for your Mazora Network account.";

/** The code, large and spaced so it reads at a glance and copies cleanly. */
function codeBlock(code: string): string {
  return detailBox(
    `<p class="mz-ink" style="margin:0;font-family:'Consolas','SFMono-Regular',Menlo,monospace;font-size:34px;line-height:1.2;font-weight:700;letter-spacing:8px;text-align:center;color:${C.ink};">${escapeHtml(code)}</p>`,
  );
}

export function buildCodeEmail(input: {
  purpose: CodeEmailPurpose;
  code: string;
  origin: string;
  support: string | null;
}): CodeEmail {
  const copy = COPY[input.purpose];
  const origin = cleanOrigin(input.origin);

  const text = [
    copy.lead,
    "",
    `Your code: ${input.code}`,
    "",
    copy.scope,
    "",
    `Didn't ask for this? ${copy.notYou}`,
    "",
    "— The Mazora Network team",
    "",
    REASON,
    ...(input.support ? [`Questions? ${input.support}`] : []),
  ].join("\n");

  const body = [
    heading(escapeHtml(copy.heading)),
    paragraph(escapeHtml(copy.lead)),
    codeBlock(input.code),
    paragraph(escapeHtml(copy.scope), "20px 0 0"),
    paragraph(`${strong("Didn&rsquo;t ask for this?")} ${escapeHtml(copy.notYou)}`, "14px 0 0"),
  ].join("\n              ");

  const html = emailShell({
    title: copy.subject,
    preheader: `${input.code} is your code. ${copy.scope}`,
    origin,
    body,
    reason: REASON,
    support: input.support,
  });

  return { subject: copy.subject, html, text };
}
