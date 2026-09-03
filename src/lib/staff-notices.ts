/**
 * Discord notice templates.
 *
 * Pure on purpose — no I/O and no "server-only" import — so the admin page and
 * the /staff-notice slash command render identical text, and so the wording can
 * be unit-tested without a Discord token.
 *
 * Every template may be sent to ANY member of the guild. An earlier version
 * required "terminated" and "promotion" recipients to hold a linked staff
 * account, which blocked the ordinary case of promoting someone who has not
 * linked a site account yet. `templateMentionsStaffTeam` now only drives a
 * wording warning in the composer.
 */

import { site } from "@/lib/site";

export type StaffNoticeTemplate = "terminated" | "warning" | "promotion" | "custom";

export const STAFF_NOTICE_TEMPLATES: readonly StaffNoticeTemplate[] = [
  "terminated",
  "warning",
  "promotion",
  "custom",
] as const;

/**
 * Whether this template's wording refers to the staff team.
 *
 * This does NOT gate anything — every template may be sent to any member of the
 * guild. It exists so the composer can warn that the copy says "staff team",
 * which is wrong if the recipient is an ordinary member.
 *
 * The link requirement this replaced blocked a legitimate case: promoting
 * someone who has not linked a site account yet — often the very people being
 * made staff for the first time. Whether the wording fits is a judgement the
 * operator makes with the preview in front of them, not something the code can
 * decide.
 */
export function templateMentionsStaffTeam(template: StaffNoticeTemplate): boolean {
  return template === "terminated" || template === "promotion";
}

/**
 * One-click starting points for the reason field.
 *
 * Shared deliberately: the admin page renders these as chips, and the slash
 * command serves the same list as Discord autocomplete. Keeping one copy is
 * what stops the two surfaces offering different canned wording.
 *
 * Discord's autocomplete caps a choice at 100 characters and a response at 25
 * choices — both enforced by tests rather than by trust.
 */
export const SUGGESTED_REASONS: Record<StaffNoticeTemplate, readonly string[]> = {
  warning: [
    "Spamming in chat after being asked to stop.",
    "Disrespectful behaviour toward other members.",
    "Advertising another server.",
    "Inappropriate language in a public channel.",
    "Ignoring instructions from a staff member.",
  ],
  custom: [
    "Please open a support ticket so we can help you properly.",
    "Your report has been reviewed and actioned. Thank you for letting us know.",
    "A reminder to read our community rules before posting again.",
  ],
  promotion: [
    "Consistently helpful and active in the community.",
    "Excellent handling of player reports during your trial.",
    "Promoted after a successful trial period.",
  ],
  terminated: [
    "Extended inactivity without notice.",
    "Breach of the staff conduct policy.",
    "Misuse of staff permissions.",
  ],
};

/**
 * Suggestions for a template, narrowed by what has been typed so far.
 *
 * Substring rather than prefix matching, because a reason is a sentence and the
 * distinguishing word is rarely the first one — typing "spam" should find
 * "Spamming in chat…" but also anything else mentioning it.
 *
 * Takes a plain string rather than StaffNoticeTemplate: the value arrives from
 * a Discord interaction payload and may be anything at all.
 */
export function suggestionsFor(template: string, typed: string): string[] {
  const list = SUGGESTED_REASONS[template as StaffNoticeTemplate];
  if (!list) return [];
  const needle = typed.trim().toLowerCase();
  if (!needle) return [...list];
  return list.filter((suggestion) => suggestion.toLowerCase().includes(needle));
}

export interface StaffNoticeInput {
  template: StaffNoticeTemplate;
  username: string;
  reason: string;
  /** Required for the "custom" template, ignored otherwise. */
  customTitle?: string;
  /**
   * Where the recipient should go to respond. Defaults to the configured
   * support ticket channel; overridable so this stays unit-testable.
   */
  supportUrl?: string;
  /**
   * Per-send wording edits from the composer's preview.
   *
   * Blank means "use the template" — an empty edit box must never produce an
   * empty headline or a bodyless notice. The reply footer is deliberately NOT
   * overridable: it is the only route to a human, and the body is truncated to
   * protect it.
   */
  titleOverride?: string;
  openingOverride?: string;
}

export const MAX_REASON_LENGTH = 1000;
export const MAX_TITLE_LENGTH = 120;

/**
 * Cap on an edited opening line.
 *
 * Generous, but bounded: the description also carries the reason and the reply
 * footer, and Discord rejects an embed description over 4096 characters.
 */
export const MAX_OPENING_LENGTH = 2000;

/** A trimmed override, or null when it is absent or blank. */
function override(value: string | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Discord rejects an embed description over 4096 characters. */
const MAX_DESCRIPTION = 4096;

interface TemplateDefinition {
  title: string;
  colour: number;
  body: (username: string) => string;
}

const DEFINITIONS: Record<Exclude<StaffNoticeTemplate, "custom">, TemplateDefinition> = {
  terminated: {
    title: "Staff Position Terminated",
    colour: 0xdc2626,
    body: (username) =>
      `Hi ${username}, you have been terminated from the Mazora Network staff team. Your staff permissions have been withdrawn.`,
  },
  warning: {
    title: "Warning from Mazora Network",
    colour: 0xf59e0b,
    body: (username) =>
      `Hi ${username}, this is a formal warning from the Mazora Network moderation team regarding your conduct in our community.`,
  },
  promotion: {
    title: "Staff Promotion",
    colour: 0x16a34a,
    body: (username) =>
      `Hi ${username}, congratulations — your rank on the Mazora Network staff team has been raised.`,
  },
};

export function validateStaffNotice(
  input: StaffNoticeInput,
): { ok: true } | { ok: false; message: string } {
  if (!STAFF_NOTICE_TEMPLATES.includes(input.template)) {
    return { ok: false, message: "Unknown notice template." };
  }
  if (!input.username.trim()) {
    return { ok: false, message: "The recipient is missing." };
  }
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, message: "A reason is required." };
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, message: `The reason must be ${MAX_REASON_LENGTH} characters or fewer.` };
  }
  if (input.template === "custom") {
    const title = (input.customTitle ?? "").trim();
    if (!title) return { ok: false, message: "A custom notice needs a title." };
    if (title.length > MAX_TITLE_LENGTH) {
      return { ok: false, message: `The title must be ${MAX_TITLE_LENGTH} characters or fewer.` };
    }
  }
  return { ok: true };
}

/**
 * The exact DM payload.
 *
 * `allowed_mentions: { parse: [] }` is the security control, not decoration: the
 * reason is operator-typed free text, and without this an "@everyone" inside it
 * would ping the recipient's client. Escaping the text instead would corrupt
 * legitimate reasons that mention a username.
 */
/**
 * Neutralise Discord markdown in the recipient's name so a display name like
 * `**Owner**` or `> quote` cannot restyle the notice it is embedded in. The
 * reason is deliberately NOT escaped (see the payload comment above) — only the
 * name, which a member controls, is. Mirrors the store-order embed's escaping.
 */
function escapeMarkdown(value: string): string {
  return value.replace(/[\\*_~`|>]/g, (match) => `\\${match}`);
}

/**
 * The notice as plain text, for anywhere that is not a Discord embed.
 *
 * renderStaffNotice returns an embed object, which the site inbox cannot use.
 * Deriving both from the same definitions keeps the DM and the inbox row from
 * drifting into two subtly different messages about the same event.
 */
export function staffNoticeText(input: StaffNoticeInput): { title: string; message: string } {
  const username = input.username.trim();
  const reason = input.reason.trim();

  const title =
    override(input.titleOverride, MAX_TITLE_LENGTH) ??
    (input.template === "custom"
      ? (input.customTitle ?? "").trim().slice(0, MAX_TITLE_LENGTH)
      : DEFINITIONS[input.template].title);

  const opening =
    override(input.openingOverride, MAX_OPENING_LENGTH) ??
    (input.template === "custom"
      ? `Hi ${username}, a message from the Mazora Network team.`
      : DEFINITIONS[input.template].body(username));

  return { title, message: `${opening}\n\n${reason}` };
}

export function renderStaffNotice(input: StaffNoticeInput): Record<string, unknown> {
  const username = escapeMarkdown(input.username.trim());
  const reason = input.reason.trim();

  const title =
    override(input.titleOverride, MAX_TITLE_LENGTH) ??
    (input.template === "custom"
      ? (input.customTitle ?? "").trim().slice(0, MAX_TITLE_LENGTH)
      : DEFINITIONS[input.template].title);

  const colour = input.template === "custom" ? 0x8b5cf6 : DEFINITIONS[input.template].colour;

  const opening =
    override(input.openingOverride, MAX_OPENING_LENGTH) ??
    (input.template === "custom"
      ? `Hi ${username}, a message from the Mazora Network team.`
      : DEFINITIONS[input.template].body(username));

  /*
    The bot that sends these has no gateway connection, so it cannot read a
    reply — a recipient who hits reply is talking to nobody. That is worst
    exactly where it matters most: someone told they have been warned or
    terminated will want to respond immediately. Saying so on every notice,
    and naming the channel that IS monitored, is the difference between a
    dead end and a route to a human.

    Appended after the reason so it never interrupts the message itself. The
    BODY is truncated to leave room for it, rather than truncating the whole
    string: an over-long reason must never be able to cut off the one line
    telling the recipient how to reach a human. Callers validate the reason to
    1000 characters first, so this only fires if that gate is ever bypassed.
  */
  const support = input.supportUrl ?? site.discordSupportTickets;
  const replyNote =
    `\n\n— — —\n🤖 This message was sent by an automated bot, which **cannot read replies**. ` +
    `To respond, open a ticket and a staff member will get back to you:\n${support}`;

  const body = `${opening}\n\n**Reason:**\n${reason}`.slice(0, MAX_DESCRIPTION - replyNote.length);
  const description = `${body}${replyNote}`;

  return {
    embeds: [
      {
        title,
        description,
        color: colour,
        footer: { text: "Mazora Network" },
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
