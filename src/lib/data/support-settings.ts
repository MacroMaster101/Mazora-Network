import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { site } from "@/lib/site";

export type SupportFaq = { question: string; answer: string };

export type SupportMainSettings = {
  eyebrow: string;
  title: string;
  lead: string;
  responseBadge: string;
  availabilityBadge: string;
  trustBadge: string;
  searchPlaceholder: string;
  faqTitle: string;
  faqSubtitle: string;
  faqs: SupportFaq[];
};

export type SupportPageDetails = {
  eyebrow: string;
  title: string;
  lead: string;
  ticketType: string;
  details: string[];
  privacyNote: string;
};

export type SupportCardSettings = {
  id: string;
  icon: string;
  title: string;
  copy: string;
  href: string;
  badge: string;
  category: "Support" | "Community" | "Apply";
  external: boolean;
  enabled: boolean;
  page?: SupportPageDetails;
};

export const SUPPORT_MAIN_KEY = "support.main";
export const SUPPORT_CARDS_KEY = "support.cards";

export const DEFAULT_SUPPORT_MAIN: SupportMainSettings = {
  eyebrow: "We're here for you",
  title: "Support & Community Center",
  lead: "Pick the option that fits your request. Get assistance, join discussions, apply for staff, or submit appeals.",
  responseBadge: "Response time: under 24h",
  availabilityBadge: "Live Staff Online",
  trustBadge: "Official Help Desk",
  searchPlaceholder: "Search help topics, tickets, forum...",
  faqTitle: "Frequently Asked Questions",
  faqSubtitle: "Quick answers to the most common inquiries.",
  faqs: [
    { question: "How long do ban appeals take?", answer: "Most appeals are reviewed within 24 to 48 hours by our staff team." },
    { question: "Who can see my report or support ticket?", answer: "Discord ticket channels are private to you and authorised Mazora staff." },
    { question: "How do I apply for staff or content creator?", answer: "Use the Staff Application or Content Creator Application cards above to open the official application form." },
    { question: "Where can I discuss server updates and ideas?", answer: "Use the Discussion Forum card or join our official Discord community." },
    { question: "I bought something but didn't receive it in game.", answer: "Open a Payment & Store Help Discord ticket with your order reference and safely redacted proof of purchase." },
  ],
};

const guide = (eyebrow: string, title: string, lead: string, ticketType: string, details: string[], privacyNote: string): SupportPageDetails => ({
  eyebrow, title, lead, ticketType, details, privacyNote,
});

export const DEFAULT_SUPPORT_CARDS: SupportCardSettings[] = [
  { id: "ticket", icon: "ticket", title: "Open a support ticket", copy: "Get direct, private account, technical or general assistance from our staff team.", href: "/support/ticket", badge: "Direct Help", category: "Support", external: false, enabled: true, page: guide("Direct Help", "Open a support ticket", "Need help with your account, the server, or something else? Prepare the details below, then open a private Discord ticket with our staff team.", "support", ["Your exact Minecraft username and the platform you use (Java or Bedrock).", "A short subject explaining whether this is account, technical, server, or general help.", "A clear description of what happened, when it started, and what you have already tried.", "Screenshots, video links, or the exact error message if one is available."], "Your ticket channel is private to you and authorised Mazora staff. Never share passwords, recovery codes, or other account secrets.") },
  { id: "forum", icon: "messages", title: "Discussion forum", copy: "Join community discussions, talk server updates, game modes, builds and news.", href: "/forums", badge: "Community", category: "Community", external: false, enabled: true },
  { id: "appeal", icon: "gavel", title: "Ban & Mute appeal", copy: "Think a punishment was a mistake? Submit an official appeal for review.", href: "/support/appeal", badge: "Appeals", category: "Support", external: false, enabled: true, page: guide("Support & Moderation", "Ban & Mute Appeal", "Made a mistake, or think a punishment was issued in error? Submit an official appeal form for moderator review.", "appeal", ["Your exact Minecraft username and punishment type.", "The exact punishment reason shown on screen.", "A detailed and honest explanation of why the punishment should be reviewed.", "Unedited screenshot or video evidence links, if available."], "Appeals are reviewed privately. Repeated submissions do not speed up a decision.") },
  { id: "staff", icon: "shield-check", title: "Staff application", copy: "Apply to join the Mazora staff team as a helper, moderator or builder.", href: "/support/staff-application", badge: "Recruitment", category: "Apply", external: false, enabled: true, page: guide("Join the Crew", "Staff Application", "Mazora is community-run. If you are patient, dependable, and excited to help players, we would love to hear from you.", "staff application", ["Your exact Minecraft username, age, timezone, and weekly availability.", "The staff role you are applying for.", "Relevant moderation, building, development, or community experience.", "Why you want to join Mazora and how you will help players."], "Applications are reviewed by staff management. Keep all submitted information accurate.") },
  { id: "creator", icon: "video", title: "Content creator application", copy: "Apply for creator perks, series promotion, and official partner rank.", href: "/support/content-creator", badge: "Partners", category: "Apply", external: false, enabled: true, page: guide("Creator program", "Tell stories from inside Mazora.", "We work with thoughtful creators who make useful, entertaining, and original Minecraft content for the community.", "creator application", ["Links to your active channel, stream, or creator portfolio.", "Your primary content format and publishing schedule.", "Average views, followers, subscribers, or live audience statistics.", "Your planned Mazora videos, series, guides, or event coverage."], "Only submit channels and statistics that belong to you.") },
  { id: "report-player", icon: "shield-alert", title: "Report a player", copy: "Report cheating, harassment, scamming or griefing confidentially to staff.", href: "/support/report-player", badge: "Safety", category: "Support", external: false, enabled: true, page: guide("Safety & Moderation", "Report a player", "Help us keep Mazora fair. Prepare accurate details and evidence, then create a confidential Discord ticket for the moderation team.", "player report", ["Your Minecraft username and the exact username of the reported player.", "The game mode or server, date, approximate time, and timezone.", "A factual description of what happened and which rule may have been broken.", "Unedited screenshots or video evidence uploaded to a safe link."], "Reports are confidential. Do not confront the reported player or submit false or edited evidence.") },
  { id: "report-bug", icon: "bug", title: "Report a bug", copy: "Found something broken? Report it privately to our development team.", href: "/support/report-bug", badge: "Bug Squad", category: "Support", external: false, enabled: true, page: guide("Bug Squad", "Report a bug", "Found something broken on the server or website? Give our team enough detail to reproduce it, then submit it through a private Discord ticket.", "bug report", ["Your Minecraft username, game mode or website page, and platform.", "Your Minecraft version, device, launcher, mods, or resource packs.", "Numbered steps that reproduce the bug and the expected result.", "Screenshots, a short video, or exact error text without account secrets."], "Report exploits privately and do not demonstrate them publicly.") },
  { id: "suggestions", icon: "lightbulb", title: "Suggest a feature", copy: "Have an idea to make Mazora better? Share it with our team and community.", href: "/support/suggestions", badge: "Feedback", category: "Community", external: false, enabled: true, page: guide("Shape the network", "Suggest a feature", "The best ideas come from players. Share yours with enough detail for the team and community to understand it.", "suggestion", ["A short title that clearly describes the idea.", "Whether it affects gameplay, the website, Discord, events, or the store.", "What should change and why it would improve Mazora.", "Examples, mockups, or references that explain the idea."], "Suggestions may be discussed publicly. Do not include private account information.") },
  { id: "payment", icon: "credit-card", title: "Payment & Store help", copy: "Questions about store purchases, missing rank items, or payment methods.", href: "/support/store-help", badge: "Store Help", category: "Support", external: false, enabled: true, page: guide("Store Help", "Payment & Store help", "Questions about an order, missing rank, store item, or payment method? Gather your purchase details and contact the store team privately on Discord.", "store support", ["Your exact Minecraft username and connected Discord username.", "The order reference, item or rank name, and approximate purchase date.", "A clear explanation of what is missing, incorrect, or pending.", "A receipt or payment screenshot with sensitive information hidden."], "Never send passwords, full card numbers, CVVs, bank logins, or recovery codes.") },
  { id: "rules", icon: "scroll", title: "Server rules & guidelines", copy: "Review our official network rules to keep your account safe and fair.", href: "/rules", badge: "Rules", category: "Support", external: false, enabled: true },
  { id: "discord", icon: "discord", title: "Discord community support", copy: "Chat live with active staff members and players on our Discord server.", href: site.discord, badge: "Live Discord", category: "Community", external: true, enabled: true },
];

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = getDb();
    if (!db) return fallback;
    const [row] = await db.select({ value: schema.siteSettings.settingValue }).from(schema.siteSettings).where(eq(schema.siteSettings.settingKey, key)).limit(1);
    return row?.value && typeof row.value === "object" ? row.value as T : fallback;
  } catch {
    return fallback;
  }
}

export async function getSupportMainSettings() {
  const value = await readSetting<SupportMainSettings>(SUPPORT_MAIN_KEY, DEFAULT_SUPPORT_MAIN);
  return { ...DEFAULT_SUPPORT_MAIN, ...value, faqs: Array.isArray(value.faqs) ? value.faqs : DEFAULT_SUPPORT_MAIN.faqs };
}

/*
  cache() so generateMetadata and the page body on /support/[cardId] (and the
  hub layout) share one settings read per request instead of re-querying.
*/
export const getSupportCards = cache(async () => {
  const value = await readSetting<SupportCardSettings[]>(SUPPORT_CARDS_KEY, DEFAULT_SUPPORT_CARDS);
  return Array.isArray(value) && value.length > 0 ? value : DEFAULT_SUPPORT_CARDS;
});

export async function getSupportCard(id: string) {
  const cards = await getSupportCards();
  const card = cards.find((item) => item.id === id);
  const fallback = DEFAULT_SUPPORT_CARDS.find((item) => item.id === id);
  if (!card) return fallback!;
  return { ...fallback, ...card, page: card.page ?? fallback?.page };
}

export async function findSupportCard(idOrSlug: string) {
  const cards = await getSupportCards();
  const expectedHref = `/support/${idOrSlug}`;
  return cards.find((card) => card.id === idOrSlug || card.href === expectedHref);
}
