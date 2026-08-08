"use client";

import { useState, type ReactNode } from "react";
import { Image as ImageIcon, ListTree, Sparkles, Star } from "lucide-react";

type TabKey = "welcome" | "featured" | "roadmap";

const TABS: { key: TabKey; label: string; hint: string; icon: typeof ImageIcon }[] = [
  { key: "welcome", label: "Welcome Banner", hint: "Store Home hero", icon: ImageIcon },
  { key: "featured", label: "Featured Picks", hint: "Top 3 products", icon: Star },
  { key: "roadmap", label: "Roadmap", hint: "Upcoming features", icon: ListTree },
];

export function StorePageSettingsHub({
  welcome,
  featured,
  roadmap,
}: {
  welcome: ReactNode;
  featured: ReactNode;
  roadmap: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("welcome");

  return (
    <section className="store-admin-settings-hub">
      <div className="store-admin-settings-hub-head">
        <p className="eyebrow flex items-center gap-2">
          <Sparkles size={13} /> Page settings
        </p>
        <h2 className="mt-2 font-display text-xl font-black tracking-tight">Storefront content</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Edit what shoppers see on Store Home before they reach the catalog.
        </p>
      </div>

      <div className="store-admin-settings-tabs" role="tablist" aria-label="Store page settings">
        {TABS.map(({ key, label, hint, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            className={`store-admin-settings-tab ${active === key ? "is-active" : ""}`}
            onClick={() => setActive(key)}
          >
            <span className="store-admin-settings-tab-icon">
              <Icon size={20} />
            </span>
            <strong>{label}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>

      <div className="store-admin-settings-panel">
        <div hidden={active !== "welcome"}>{welcome}</div>
        <div hidden={active !== "featured"}>{featured}</div>
        <div hidden={active !== "roadmap"}>{roadmap}</div>
      </div>
    </section>
  );
}
