"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
}

const HEADER_OFFSET = 104;

function preferredScrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  const top = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: preferredScrollBehavior() });
  window.history.pushState(null, "", `#${id}`);
}

export function LegalToc({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const elements = sections.map((s) => document.getElementById(s.id));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-96px 0px -70% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      elements.forEach((el) => {
        if (el) observer.unobserve(el);
      });
    };
  }, [sections]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    scrollToSection(id);
    setActiveId(id);
  };

  return (
    <aside className="legal-toc hidden lg:block lg:sticky lg:top-24 lg:self-start w-full select-none">
      <div className="glass p-4 sm:p-5 rounded-2xl border border-line/60 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-line/50 pb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted flex items-center gap-2">
            <ListFilter size={14} className="text-accent-bright" />
            <span>On this page</span>
          </h2>
          <span className="text-[10px] font-mono font-bold bg-accent/10 text-accent-bright px-2 py-0.5 rounded-md border border-accent/20">
            {sections.length} sections
          </span>
        </div>

        <nav aria-label="Page sections" className="flex flex-col gap-1 max-h-[calc(100vh-180px)] overflow-y-auto pr-1 scrollbar-thin">
          {sections.map((s, idx) => {
            const isActive = activeId === s.id;
            const indexStr = String(idx + 1).padStart(2, "0");
            const cleanTitle = s.title.replace(/^(\d+\.\s*)+/, "");

            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-accent/15 text-accent-bright font-semibold border-l-2 border-accent-bright translate-x-1 shadow-sm"
                    : "text-muted hover:bg-surface/50 hover:text-ink hover:translate-x-0.5"
                )}
              >
                <span className={cn(
                  "font-mono text-[10px] shrink-0 opacity-70 transition-colors",
                  isActive ? "text-accent-bright font-bold" : "text-muted group-hover:text-ink"
                )}>
                  {indexStr}
                </span>
                <span className="truncate">{cleanTitle}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function LegalMobileToc({ sections }: { sections: Section[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsOpen(false);
    setActiveId(id);
    setTimeout(() => {
      scrollToSection(id);
    }, 50);
  };

  return (
    <div className="lg:hidden mb-6 p-4 rounded-xl glass border border-line/60 select-none">
      <details open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)} className="group">
        <summary className="flex items-center justify-between text-sm font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-bright animate-pulse" />
            Table of Contents
          </span>
          <span className="transition-transform duration-200 group-open:rotate-180">
            <ChevronDown size={16} className="text-muted" />
          </span>
        </summary>
        <nav aria-label="Page sections" className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-line/50">
          {sections.map((s, idx) => {
            const indexStr = String(idx + 1).padStart(2, "0");
            const cleanTitle = s.title.replace(/^(\d+\.\s*)+/, "");
            const isActive = activeId === s.id;

            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive ? "bg-accent/15 text-accent-bright font-bold" : "text-muted hover:text-ink"
                )}
              >
                <span className="font-mono text-[10px] opacity-70">{indexStr}</span>
                <span className="truncate">{cleanTitle}</span>
              </a>
            );
          })}
        </nav>
      </details>
    </div>
  );
}
