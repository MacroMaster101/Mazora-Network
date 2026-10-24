/**
 * The welcome email sent once, on a member's first sign-in.
 *
 * Pure: takes a name and an origin, returns the message. Kept free of any
 * transport or database import so the wording and escaping can be tested
 * directly, the same split the presence and store-message templates use.
 *
 * The frame is the shared one in ./layout, the same design as the Supabase
 * auth templates, so every email a member receives looks like it came from
 * the same place.
 *
 * Deliberately carries no Supabase `{{ .Token }}`-style variables. Those are
 * expanded by Supabase's own mailer; this message is sent by the app through
 * Resend, where they would arrive as literal text.
 */

import { supportEmail } from "@/lib/support-contact";
import { C, button, cleanOrigin, detailBox, emailShell, escapeHtml, greetingFor, heading, paragraph } from "./layout";

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

/** The three things a new member most likely wants to do first. */
const NEXT_STEPS: ReadonlyArray<[title: string, detail: string]> = [
  ["Link your Minecraft name", "Rank and stats follow you in game"],
  ["Browse the store", "Ranks, keys and cosmetics"],
  ["Open a support ticket", "The team replies in Discord"],
];

const REASON = "You are receiving this because an account was created with this email address.";

export function buildWelcomeEmail(input: {
  name: string | null;
  origin: string;
  /** Defaults to the configured public support address. */
  support?: string | null;
}): WelcomeEmail {
  const greeting = greetingFor(input.name);
  const origin = cleanOrigin(input.origin);
  const support = input.support === undefined ? supportEmail : input.support;

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
    REASON,
    ...(support ? [`Questions? ${support}`] : []),
  ].join("\n");

  const steps = NEXT_STEPS.map(
    ([title, detail], index) =>
      `<tr>
                    <td width="40" valign="top" style="padding:${index === 0 ? "0" : "14px"} 0 0;"><div class="mz-num" style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${C.numBg};color:${C.accent};font-size:13px;font-weight:700;text-align:center;">${index + 1}</div></td>
                    <td valign="top" style="padding:${index === 0 ? "0" : "14px"} 0 0;"><p class="mz-ink" style="margin:0;font-size:14px;line-height:1.4;font-weight:600;color:${C.ink};">${escapeHtml(title)}</p><p class="mz-dim" style="margin:2px 0 0;font-size:13px;line-height:1.5;color:${C.dim};">${escapeHtml(detail)}</p></td>
                  </tr>`,
  ).join("");

  const body = [
    heading("Welcome to Mazora"),
    paragraph(`${escapeHtml(greeting)} your account is ready. Here&rsquo;s where to start:`),
    detailBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}</table>`),
    `<div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>`,
    button(`${origin}/dashboard`, "Open your dashboard"),
    paragraph("See you on the server.", "20px 0 0"),
  ].join("\n              ");

  const html = emailShell({
    title: "Welcome to Mazora Network",
    preheader: "Your Mazora Network account is ready. Here's where to start.",
    origin,
    body,
    reason: REASON,
    support,
  });

  return { subject: "Welcome to Mazora Network", html, text };
}
