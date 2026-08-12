"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SupportCardSettings, SupportMainSettings } from "@/lib/data/support-settings";

const SupportSettingsContext = createContext<{ main: SupportMainSettings; cards: SupportCardSettings[] } | null>(null);

export function SupportSettingsProvider({ main, cards, children }: { main: SupportMainSettings; cards: SupportCardSettings[]; children: ReactNode }) {
  return <SupportSettingsContext.Provider value={{ main, cards }}>{children}</SupportSettingsContext.Provider>;
}

export function useSupportSettings() {
  const value = useContext(SupportSettingsContext);
  if (!value) throw new Error("SupportSettingsProvider is missing.");
  return value;
}
