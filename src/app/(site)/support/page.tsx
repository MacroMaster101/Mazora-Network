"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Headset, Search } from "lucide-react";
import { Accordion } from "@/components/ui";
import { FloatingBrandLogo, PageHero, Reveal } from "@/components/shared";
import { DiscordIcon } from "@/components/shared/icon";
import { SupportCardIcon } from "@/components/shared/support-card-icon";
import { useSupportSettings } from "@/components/shared/support-settings-provider";

const categories = [
  { id: "all", label: "All Topics" }, { id: "Support", label: "Help & Tickets" },
  { id: "Community", label: "Community & Forum" }, { id: "Apply", label: "Applications" },
];

export default function SupportPage() {
  const { main, cards } = useSupportSettings();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  useEffect(() => { try { const saved = localStorage.getItem("mazora_support_card_clicks"); if (saved) setClickCounts(JSON.parse(saved)); } catch {} }, []);
  const handleCardClick = (id: string) => { const updated = { ...clickCounts, [id]: (clickCounts[id] || 0) + 1 }; setClickCounts(updated); try { localStorage.setItem("mazora_support_card_clicks", JSON.stringify(updated)); } catch {} };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = cards.filter((card) => card.enabled && (activeCategory === "all" || card.category === activeCategory) && (!normalizedQuery || `${card.title} ${card.copy} ${card.badge}`.toLowerCase().includes(normalizedQuery)));

  return <>
    <PageHero eyebrow={main.eyebrow} title={main.title} lead={main.lead} illustration={<FloatingBrandLogo />}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-xs font-bold text-slate-800 shadow-sm dark:border-purple-500/30 dark:bg-purple-950/60 dark:text-purple-200 sm:text-sm"><Headset size={16} className="text-purple-600 dark:text-purple-400" /> {main.responseBadge}</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-xs font-bold text-slate-800 shadow-sm dark:border-purple-500/30 dark:bg-purple-950/60 dark:text-purple-200 sm:text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /> {main.availabilityBadge}</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-xs font-bold text-slate-800 shadow-sm dark:border-purple-500/30 dark:bg-purple-950/60 dark:text-purple-200 sm:text-sm"><CheckCircle2 size={16} className="text-emerald-500" /> {main.trustBadge}</span>
      </div>
    </PageHero>

    <section className="section shell">
      <Reveal><div className="support-controls mb-10"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="support-search"><Search size={18} className="support-search-icon" /><label htmlFor="support-search" className="sr-only">Search support topics</label><input id="support-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={main.searchPlaceholder} /></div>
        <div className="flex flex-wrap items-center gap-2">{categories.map((category) => <button key={category.id} aria-pressed={activeCategory === category.id} onClick={() => setActiveCategory(category.id)} className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all sm:text-sm ${activeCategory === category.id ? "scale-105 bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "border border-slate-300 bg-white/90 text-slate-800 hover:border-purple-600 hover:bg-purple-600 hover:text-white dark:border-purple-500/30 dark:bg-purple-950/50 dark:text-purple-200"}`}>{category.label}</button>)}</div>
      </div></div></Reveal>

      {filteredCards.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredCards.map((card, index) => {
        const popular = (clickCounts[card.id] || 0) >= 3;
        return <Reveal key={card.id} delay={index * 0.03}><Link href={card.href} onClick={() => handleCardClick(card.id)} target={card.external ? "_blank" : undefined} rel={card.external ? "noreferrer" : undefined} className="group relative flex h-full flex-col rounded-2xl border border-slate-300/80 bg-white/85 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-purple-500 hover:ring-2 hover:ring-purple-500/30 dark:border-purple-900/50 dark:bg-[#0c0618]/85">
          <div className="flex items-center justify-between"><div className="grid h-12 w-12 place-items-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-700 transition-all group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white dark:text-purple-300"><SupportCardIcon name={card.icon} size={22} /></div><span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">{card.badge}</span></div>
          <h3 className="mt-5 font-display text-base font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-purple-700 dark:text-white dark:group-hover:text-purple-300 sm:text-lg">{card.title}</h3><p className="mt-2 flex-1 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">{card.copy}</p>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-purple-900/40"><span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900 transition-all group-hover:translate-x-1 group-hover:text-purple-700 dark:text-white dark:group-hover:text-purple-300 sm:text-sm">Continue <ArrowRight size={15} /></span>{popular && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Popular</span>}</div>
        </Link></Reveal>;
      })}</div> : <div className="rounded-2xl border border-slate-200 bg-white/95 px-8 py-16 text-center dark:border-purple-900/50 dark:bg-[#0c0618]/95"><p className="text-lg font-extrabold text-slate-900 dark:text-white">No matching help topics found</p><button onClick={() => { setQuery(""); setActiveCategory("all"); }} className="mt-5 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-bold text-white">Reset Filters</button></div>}

      <Reveal className="mt-16"><div className="rounded-2xl border border-slate-300/80 bg-white/85 p-6 shadow-sm dark:border-purple-900/50 dark:bg-[#0c0618]/85 md:p-8"><div className="flex flex-col gap-3 border-b border-slate-100 pb-6 dark:border-purple-900/40 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{main.faqTitle}</h2><p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{main.faqSubtitle}</p></div><a href="https://discord.gg/ZPrzyGpMyt" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-extrabold text-purple-700 hover:underline dark:text-purple-400"><DiscordIcon size={16} /> Need instant help? Join Discord</a></div><Accordion className="mt-6" items={main.faqs.map((faq) => ({ q: faq.question, a: faq.answer }))} /></div></Reveal>
    </section>
  </>;
}
