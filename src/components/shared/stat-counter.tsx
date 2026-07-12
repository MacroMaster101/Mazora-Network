"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated count-up. Parses a display string like "18.4K", "99.98%", "247"
 * and animates the numeric portion once it scrolls into view. Respects
 * prefers-reduced-motion (jumps straight to the final value).
 */
export function StatCounter({ value, className }: { value: string; className?: string }) {
  const match = value.match(/^([\d.,]+)(.*)$/);
  const target = match ? parseFloat(match[1].replace(/,/g, "")) : NaN;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;

  const [display, setDisplay] = useState(isNaN(target) ? value : "0");
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    setDisplay(isNaN(target) ? value : "0");

    if (isNaN(target)) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const format = (n: number) =>
      n.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const duration = 1300;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(format(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, suffix, decimals, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
