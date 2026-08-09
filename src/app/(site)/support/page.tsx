"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bug,
  CreditCard,
  Gavel,
  Lightbulb,
  Headset,
  ShieldAlert,
  Ticket,
  ArrowRight,
  ShieldCheck,
  Video,
  ScrollText,
  MessagesSquare,
  Search,
  CheckCircle2,
} from "lucide-react";
import { DiscordIcon } from "@/components/shared/icon";
import { PageHero, Reveal } from "@/components/shared";
import { Accordion } from "@/components/ui";

const categories = [
  { id: "all", label: "All Topics" },
  { id: "Support", label: "Help & Tickets" },
  { id: "Community", label: "Community & Forum" },
  { id: "Apply", label: "Applications" },
];

const supportCards = [
  {
    id: "ticket",
    icon: Ticket,
    title: "Open a support ticket",
    copy: "Get direct, private account, technical or general assistance from our staff team.",
    href: "/dashboard/tickets",
    badge: "Direct Help",
    category: "Support",
  },
  {
    id: "forum",
    icon: MessagesSquare,
    title: "Discussion forum",
    copy: "Join community discussions, talk server updates, game modes, builds and news.",
    href: "/forums",
    badge: "Community",
    category: "Community",
  },
  {
    id: "appeal",
    icon: Gavel,
    title: "Ban & Mute appeal",
    copy: "Think a punishment was a mistake? Submit an official appeal for review.",
    href: "/support/appeal",
    badge: "Appeals",
    category: "Support",
  },
  {
    id: "staff",
    icon: ShieldCheck,
    title: "Staff application",
    copy: "Apply to join the Mazora staff team as a helper, moderator or builder.",
    href: "/support/staff-application",
    badge: "Recruitment",
    category: "Apply",
  },
  {
    id: "creator",
    icon: Video,
    title: "Content creator application",
    copy: "Apply for creator perks, series promotion, and official partner rank.",
    href: "/support/content-creator",
    badge: "Partners",
    category: "Apply",
  },
  {
    id: "report-player",
    icon: ShieldAlert,
    title: "Report a player",
    copy: "Report cheating, harassment, scamming or griefing confidentially to staff.",
    href: "/support/report-player",
    badge: "Safety",
    category: "Support",
  },
  {
    id: "report-bug",
    icon: Bug,
    title: "Report a bug",
    copy: "Found something broken? Report it to our dev team and earn in-game rewards.",
    href: "/support/report-bug",
    badge: "Bug Squad",
    category: "Support",
  },
  {
    id: "suggestions",
    icon: Lightbulb,
    title: "Suggest a feature",
    copy: "Have an idea to make Mazora better? Share it with our team and community.",
    href: "/support/suggestions",
    badge: "Feedback",
    category: "Community",
  },
  {
    id: "payment",
    icon: CreditCard,
    title: "Payment & Store help",
    copy: "Questions about store purchases, missing rank items, or payment methods.",
    href: "/dashboard/tickets",
    badge: "Store Help",
    category: "Support",
  },
  {
    id: "rules",
    icon: ScrollText,
    title: "Server rules & guidelines",
    copy: "Review our official network rules to keep your account safe and fair.",
    href: "/rules",
    badge: "Rules",
    category: "Support",
  },
  {
    id: "discord",
    icon: DiscordIcon,
    title: "Discord community support",
    copy: "Chat live with active staff members and players on our Discord server.",
    href: "https://discord.gg/ZPrzyGpMyt",
    badge: "Live Discord",
    category: "Community",
    external: true,
  },
];

const faqs = [
  { q: "How long do ban appeals take?", a: "Most appeals are reviewed within 24 to 48 hours by our staff team." },
  { q: "Who can see my report or support ticket?", a: "Only you and authorised staff can see your reports and tickets. Other players never see them." },
  { q: "How do I apply for staff or content creator?", a: "Use the Staff Application or Content Creator Application cards above to fill out our official forms." },
  { q: "Where can I discuss server updates and ideas?", a: "Check out the Discussion Forum card above or join our official Discord community!" },
  { q: "I bought something but didn't receive it in game.", a: "Open a ticket under Payment Support with your Tebex transaction details and we'll sort it out quickly." },
];

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  // Load click usage from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mazora_support_card_clicks");
      if (saved) {
        setClickCounts(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleCardClick = (id: string) => {
    const updated = { ...clickCounts, [id]: (clickCounts[id] || 0) + 1 };
    setClickCounts(updated);
    try {
      localStorage.setItem("mazora_support_card_clicks", JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const filteredCards = supportCards.filter((card) => {
    const matchesCategory = activeCategory === "all" || card.category === activeCategory;
    const matchesSearch =
      card.title.toLowerCase().includes(query.toLowerCase()) ||
      card.copy.toLowerCase().includes(query.toLowerCase()) ||
      card.badge.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      {/* Page Hero with Floating Logo on the Right */}
      <PageHero
        eyebrow="We're here for you"
        title="Support & Community Center"
        lead="Pick the option that fits your request. Get assistance, join discussions, apply for staff, or submit appeals."
        illustration={
          <div className="relative group p-2">
            <Image
              src="/images/mazora-logo.webp"
              alt="Mazora Network Logo"
              width={310}
              height={207}
              priority
              className="relative animate-float object-contain drop-shadow-[0_15px_35px_rgba(147,51,234,0.45)] transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        }
      >
        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-purple-200 bg-white/90 dark:bg-purple-950/60 border border-slate-300 dark:border-purple-500/30 px-4 py-2 rounded-full backdrop-blur-xl shadow-sm">
            <Headset size={16} className="text-purple-600 dark:text-purple-400" /> Response time: under 24h
          </span>
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-purple-200 bg-white/90 dark:bg-purple-950/60 border border-slate-300 dark:border-purple-500/30 px-4 py-2 rounded-full backdrop-blur-xl shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" /> Live Staff Online
          </span>
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-purple-200 bg-white/90 dark:bg-purple-950/60 border border-slate-300 dark:border-purple-500/30 px-4 py-2 rounded-full backdrop-blur-xl shadow-sm">
            <CheckCircle2 size={16} className="text-emerald-500" /> Official Help Desk
          </span>
        </div>
      </PageHero>

      {/* Main Section */}
      <section className="section shell">
        {/* Search & Filter Bar */}
        <Reveal>
          <div className="support-controls mb-10">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              {/* Search Box */}
              <div className="support-search">
                <Search size={18} className="support-search-icon" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search help topics, tickets, forum..."
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 ${
                      activeCategory === cat.id
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105"
                        : "bg-white/90 dark:bg-purple-950/50 border border-slate-300 dark:border-purple-500/30 text-slate-800 dark:text-purple-200 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 dark:hover:text-white hover:border-purple-600"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Support Cards Grid — Uniform by Default, Ring Highlight ONLY on Mouse Hover */}
        {filteredCards.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCards.map((c, i) => {
              const isPopular = (clickCounts[c.id] || 0) >= 3;

              return (
                <Reveal key={c.title} delay={i * 0.03}>
                  <Link
                    href={c.href}
                    onClick={() => handleCardClick(c.id)}
                    target={c.external ? "_blank" : undefined}
                    rel={c.external ? "noreferrer" : undefined}
                    className="group relative flex h-full flex-col p-6 rounded-2xl border border-slate-300/80 dark:border-purple-900/50 bg-white/85 dark:bg-[#0c0618]/85 backdrop-blur-xl shadow-sm transition-all duration-200 hover:border-purple-500 hover:ring-2 hover:ring-purple-500/30 hover:shadow-xl hover:-translate-y-1"
                  >
                    {/* Top Badge & Icon */}
                    <div className="flex items-center justify-between">
                      <div className="grid h-12 w-12 place-items-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white group-hover:border-transparent transition-all duration-200 shadow-sm">
                        <c.icon size={22} />
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                        {c.badge}
                      </span>
                    </div>

                    {/* Title & Copy */}
                    <h3 className="mt-5 font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors leading-snug">
                      {c.title}
                    </h3>
                    <p className="mt-2 flex-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      {c.copy}
                    </p>

                    {/* Action Link Footer */}
                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-purple-900/40 pt-4">
                      <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 group-hover:translate-x-1 transition-all">
                        Continue <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                      {isPopular && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          Popular
                        </span>
                      )}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 px-8 rounded-2xl border border-slate-200/90 dark:border-purple-900/50 bg-white/95 dark:bg-[#0c0618]/95 shadow-sm">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">No matching help topics found</p>
            <p className="text-sm text-slate-600 dark:text-purple-300 mt-2 font-semibold">Try clearing your search query or switching categories.</p>
            <button
              onClick={() => {
                setQuery("");
                setActiveCategory("all");
              }}
              className="mt-5 px-5 py-2.5 rounded-full bg-purple-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-purple-700 transition-all"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* FAQ Section */}
        <Reveal className="mt-16">
          <div className="p-6 md:p-8 rounded-2xl border border-slate-300/80 dark:border-purple-900/50 bg-white/85 dark:bg-[#0c0618]/85 backdrop-blur-xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-slate-100 dark:border-purple-900/40">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 font-semibold">
                  Quick answers to the most common inquiries.
                </p>
              </div>
              <a
                href="https://discord.gg/ZPrzyGpMyt"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-purple-700 dark:text-purple-400 hover:underline"
              >
                <DiscordIcon size={16} /> Need instant help? Join Discord
              </a>
            </div>
            <Accordion className="mt-6" items={faqs} />
          </div>
        </Reveal>
      </section>
    </>
  );
}
