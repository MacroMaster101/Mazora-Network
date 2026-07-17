"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
}
const HEADER_OFFSET = 104;

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
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
    <aside className="legal-toc hidden lg:block lg:sticky lg:top-28 lg:self-start w-full pr-4 select-none">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted opacity-80">
        On this page
      </h2>
      <div className="relative border-l border-line py-1">
        <nav aria-label="Page sections" className="flex flex-col gap-1 pl-4">
          {sections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "relative -ml-[17px] block border-l-2 py-0.5 pl-[16px] text-[13px] font-medium leading-5 transition-all duration-200",
                  isActive
                    ? "border-accent-bright text-accent-bright font-semibold translate-x-1"
                    : "border-transparent text-muted hover:border-line-strong hover:text-ink"
                )}
              >
                {s.title}
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
    // Wait for the details collapse transition/reflow before scroll calculation
    setTimeout(() => {
      scrollToSection(id);
    }, 50);
  };

  return (
    <div className="lg:hidden mb-6 p-4 rounded-xl bg-surface/30 border border-line select-none">
      <details open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)} className="group">
        <summary className="flex items-center justify-between text-sm font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-ink flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-bright" />
            Table of Contents
          </span>
          <span className="transition-transform duration-200 group-open:rotate-180">
            <ChevronDown size={16} className="text-muted" />
          </span>
        </summary>
        <nav aria-label="Page sections" className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-line/50">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => handleClick(e, s.id)}
              aria-current={activeId === s.id ? "location" : undefined}
              className="text-xs font-medium text-muted hover:text-accent-bright transition-colors py-0.5 block"
            >
              {s.title}
            </a>
          ))}
        </nav>
      </details>
    </div>
  );
}
