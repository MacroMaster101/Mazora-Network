/**
 * Wording for the two order DMs the bot sends buyers.
 *
 * Only the prose is configurable. Everything that states a fact about the
 * transaction — the reference, the item summary, the total, the discount code —
 * is assembled by the interaction handler and never comes from here, so this
 * panel cannot be used to compose a convincing but false receipt.
 */

/** Longest an embed title may be here. Discord's own limit is 256. */
export const MAX_TITLE = 120;
/** Longest one prose block may be. The whole description is capped at 4096. */
export const MAX_BLOCK = 600;

/**
 * The anti-fraud line, deliberately not editable.
 *
 * It is the sentence that protects a buyer from someone impersonating staff.
 * A panel that could quietly delete it would be a way to make the scam
 * message look exactly like the real one.
 */
export const PAYMENT_NOTICE = "_No payment has been taken yet — staff will never ask for card details in chat._";

export interface ConfirmedTemplate {
  title: string;
  /** Must keep {reference} and {staff}. */
  opening: string;
  /** Shown when a ticket channel was created. Must keep {ticket_link}. */
  withTicket: string;
  /** Shown when no ticket could be created. */
  withoutTicket: string;
  /** Wording of the automated-bot notice. The support link is appended after it. */
  disclaimer: string;
}

export interface DeclinedTemplate {
  title: string;
  /** Must keep {reference} and {staff}. */
  opening: string;
  closing: string;
  disclaimer: string;
}

export interface StoreMessagesConfig {
  confirmed: ConfirmedTemplate;
  declined: DeclinedTemplate;
}

export const DEFAULT_DISCLAIMER =
  "🤖 This message was sent by an automated bot, which **cannot read replies**. To respond, open a ticket and a staff member will get back to you:";

export const DEFAULT_STORE_MESSAGES: StoreMessagesConfig = {
  confirmed: {
    title: "✅ Order Confirmed!",
    opening: "Your Mazora Network order (`{reference}`) has just been confirmed by **{staff}**.",
    withTicket: "A private ticket has been opened for you — continue there: {ticket_link}",
    withoutTicket: "A staff member will reach out to you here shortly to arrange payment and finalize the delivery.",
    disclaimer: DEFAULT_DISCLAIMER,
  },
  declined: {
    title: "❌ Order Declined",
    opening: "Your Mazora Network order (`{reference}`) was reviewed and declined by **{staff}**.",
    closing: "If you believe this is a mistake or have questions, please reach out in the Mazora Discord server.",
    disclaimer: DEFAULT_DISCLAIMER,
  },
};

/**
 * Tokens a block must keep.
 *
 * These are the facts that make the message actionable: which order it is, and
 * who decided it. Rewording is fine; dropping them is not, because a buyer who
 * cannot tell which order was declined cannot dispute it.
 */
export const REQUIRED_TOKENS = {
  "confirmed.opening": ["reference", "staff"],
  "confirmed.withTicket": ["ticket_link"],
  "declined.opening": ["reference", "staff"],
} as const satisfies Record<string, readonly string[]>;

const TOKEN = /\{([a-z_]+)\}/g;

export type StoreTokens = Record<string, string | null>;

/**
 * Substitute `{token}` placeholders.
 *
 * Unlike the presence renderer this never refuses. A presence line can be
 * skipped; an order DM cannot — the buyer is owed a message either way — so an
 * unknown token collapses to nothing and the surrounding prose still sends.
 */
export function renderStoreText(template: string, tokens: StoreTokens): string {
  return template.replace(TOKEN, (_match, name: string) => tokens[name] ?? "").trim();
}

/** Which required tokens a block is missing, for the save action's error. */
export function missingTokens(template: string, required: readonly string[]): string[] {
  const present = new Set<string>();
  for (const match of template.matchAll(TOKEN)) present.add(match[1]);
  return required.filter((token) => !present.has(token));
}

/*
  A literal URL, an invite, or markdown link syntax.

  `{ticket_link}` is deliberately unaffected: it is a token the sender expands
  to a channel the bot itself created, not a destination anyone typed here.
*/
const LINK_PATTERN = /https?:\/\/|discord\.gg\/|\]\(/i;

/**
 * Whether a block tries to introduce a link of its own.
 *
 * These messages are the bot speaking to a buyer about money, and the sender
 * already appends the real support link. So nothing legitimate needs to type
 * one — while an admin account in the wrong hands could use a link here to
 * point a buyer at a convincing fake. Refusing links costs the operator
 * nothing and removes the payload from the phishing vector, leaving only text
 * that cannot be clicked.
 */
export function containsLink(template: string): boolean {
  return LINK_PATTERN.test(template);
}

const text = (value: unknown, fallback: string, max: number): string =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;

export function sanitiseStoreMessages(value: unknown): StoreMessagesConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULT_STORE_MESSAGES);
  }
  const stored = value as Partial<StoreMessagesConfig>;
  const confirmed = (stored.confirmed ?? {}) as Partial<ConfirmedTemplate>;
  const declined = (stored.declined ?? {}) as Partial<DeclinedTemplate>;
  const fallback = DEFAULT_STORE_MESSAGES;

  // A stored block that has lost a required token, or gained a link, is
  // replaced with the default rather than sent as-is. This runs on read as
  // well as write, so a direct database write cannot strip the order reference
  // out of a live buyer notification, nor slip a phishing link into one.
  const keep = (candidate: string, standard: string, required: readonly string[] = []): string =>
    missingTokens(candidate, required).length === 0 && !containsLink(candidate) ? candidate : standard;

  return {
    confirmed: {
      title: keep(text(confirmed.title, fallback.confirmed.title, MAX_TITLE), fallback.confirmed.title),
      opening: keep(
        text(confirmed.opening, fallback.confirmed.opening, MAX_BLOCK),
        fallback.confirmed.opening,
        REQUIRED_TOKENS["confirmed.opening"],
      ),
      withTicket: keep(
        text(confirmed.withTicket, fallback.confirmed.withTicket, MAX_BLOCK),
        fallback.confirmed.withTicket,
        REQUIRED_TOKENS["confirmed.withTicket"],
      ),
      withoutTicket: keep(
        text(confirmed.withoutTicket, fallback.confirmed.withoutTicket, MAX_BLOCK),
        fallback.confirmed.withoutTicket,
      ),
      disclaimer: keep(
        text(confirmed.disclaimer, fallback.confirmed.disclaimer, MAX_BLOCK),
        fallback.confirmed.disclaimer,
      ),
    },
    declined: {
      title: keep(text(declined.title, fallback.declined.title, MAX_TITLE), fallback.declined.title),
      opening: keep(
        text(declined.opening, fallback.declined.opening, MAX_BLOCK),
        fallback.declined.opening,
        REQUIRED_TOKENS["declined.opening"],
      ),
      closing: keep(text(declined.closing, fallback.declined.closing, MAX_BLOCK), fallback.declined.closing),
      disclaimer: keep(
        text(declined.disclaimer, fallback.declined.disclaimer, MAX_BLOCK),
        fallback.declined.disclaimer,
      ),
    },
  };
}

/**
 * Assemble the confirmed-order description.
 *
 * Order facts are passed in already formatted and are appended here rather
 * than interpolated into editable prose, which is what keeps them out of the
 * panel's reach. PAYMENT_NOTICE always lands immediately before the
 * disclaimer, in every configuration.
 */
export function buildConfirmedDescription(
  template: ConfirmedTemplate,
  parts: { reference: string; staff: string; ticketLink: string | null; items: string | null; total: string | null; creatorCode: string | null },
  supportUrl: string,
): string {
  const tokens: StoreTokens = {
    reference: parts.reference,
    staff: parts.staff,
    ticket_link: parts.ticketLink,
  };

  const lines = [
    renderStoreText(template.opening, tokens),
    renderStoreText(parts.ticketLink ? template.withTicket : template.withoutTicket, tokens),
    "",
    parts.items ? `**Order Summary**\n${parts.items}\n` : null,
    parts.total ? `**Total:** ${parts.total}` : null,
    parts.creatorCode ? `**Discount code:** ${parts.creatorCode}` : null,
    PAYMENT_NOTICE,
    `\n— — —\n${renderStoreText(template.disclaimer, tokens)}\n${supportUrl}`,
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

/** Assemble the declined-order description. Same rules as the confirmed one. */
export function buildDeclinedDescription(
  template: DeclinedTemplate,
  parts: { reference: string; staff: string },
  supportUrl: string,
): string {
  const tokens: StoreTokens = { reference: parts.reference, staff: parts.staff };

  return [
    renderStoreText(template.opening, tokens),
    renderStoreText(template.closing, tokens),
    `\n— — —\n${renderStoreText(template.disclaimer, tokens)}\n${supportUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}
