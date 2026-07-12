"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Scroll-aware header shell. Transparent at the very top; solidifies into a glass
 * bar once scrolled; auto-hides on scroll down and reveals on scroll up. Falls
 * back to solidify-only when the user prefers reduced motion.
 */
export function ScrollHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (!reduce) {
        if (y > 120 && y > lastY.current + 4) setHidden(true);
        else if (y < lastY.current - 4 || y <= 120) setHidden(false);
      }
      lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out",
        hidden ? "-translate-y-full" : "translate-y-0",
        pathname === "/" && !scrolled && "hero-nav",
        scrolled
          ? "border-line bg-base/80 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "border-transparent bg-base/0",
      )}
    >
      {children}
    </header>
  );
}
