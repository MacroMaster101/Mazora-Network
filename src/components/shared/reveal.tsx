"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Fade-and-rise on scroll into view.
 *
 * Reduced-motion users get the fade without the rise. That is not automatic —
 * it comes from `<MotionConfig reducedMotion="user">` in app/providers.tsx.
 * Framer Motion ignores prefers-reduced-motion unless told to honour it.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
