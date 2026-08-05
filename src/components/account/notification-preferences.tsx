"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, Calendar, LifeBuoy, Info, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface NotificationSettings {
  email: boolean;
  events: boolean;
  support: boolean;
}

const STORAGE_KEY = "mazora_user_notification_prefs";

export function NotificationPreferences() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationSettings>({
    email: true,
    events: true,
    support: true,
  });
  const [saved, setSaved] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPrefs({
            email: parsed.email ?? true,
            events: parsed.events ?? true,
            support: parsed.support ?? true,
          });
        }
      } catch {
        // Fallback to default ON
      }
    }
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    const nextState = !prefs[key];
    const updated = { ...prefs, [key]: nextState };
    setPrefs(updated);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    const labelMap = {
      email: "Email Notifications",
      events: "Event Notifications",
      support: "Support & Ticket Notifications",
    };

    toast(
      `${labelMap[key]} ${nextState ? "enabled (ON)" : "disabled (OFF)"}.`,
      nextState ? "success" : "info"
    );
  };

  const notificationItems = [
    {
      id: "email" as const,
      label: "Email notifications",
      icon: Mail,
      desc: "Receive email updates for order confirmations, store receipts, and password resets.",
      tooltip: "Turn OFF if you prefer not to receive email receipts or store order status updates.",
    },
    {
      id: "events" as const,
      label: "Event notifications",
      icon: Calendar,
      desc: "Get real-time alerts for server community events, double XP weekend drops, and tournament announcements.",
      tooltip: "Turn OFF if you do not want in-game or web alerts regarding community server events.",
    },
    {
      id: "support" as const,
      label: "Support notifications",
      icon: LifeBuoy,
      desc: "Receive notifications when staff members reply to your tickets, ban appeals, or bug reports.",
      tooltip: "Turn OFF if you do not want alerts when staff respond to your support tickets or appeals.",
    },
  ];

  return (
    <div className="space-y-4">
      {saved && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl animate-fade-in">
          <Check size={14} /> Notification preferences updated live!
        </div>
      )}

      {notificationItems.map((item) => {
        const Icon = item.icon;
        const enabled = prefs[item.id];

        return (
          <div
            key={item.id}
            className={`group relative flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all duration-200 ${
              enabled
                ? "bg-card/80 border-line hover:border-accent/40 shadow-2xs"
                : "bg-card/40 border-line/40 opacity-75"
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${
                  enabled
                    ? "bg-accent/15 text-accent-bright border-accent/25"
                    : "bg-surface text-muted border-line/50"
                }`}
              >
                <Icon size={18} />
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{item.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                      enabled
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                  >
                    {enabled ? "ON" : "OFF"}
                  </span>

                  {/* Tooltip trigger icon */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onMouseEnter={() => setActiveTooltip(item.id)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => setActiveTooltip((prev) => (prev === item.id ? null : item.id))}
                      className="text-muted hover:text-accent-bright transition-colors p-0.5 rounded-full"
                      title={item.tooltip}
                    >
                      <Info size={14} />
                    </button>

                    {/* Tooltip popup */}
                    {activeTooltip === item.id && (
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-xl bg-ink/95 text-white text-xs leading-relaxed shadow-xl border border-line-strong/60 z-50 animate-fade-in pointer-events-none">
                        <p className="font-semibold text-accent-bright mb-1">💡 Quick Info</p>
                        {item.tooltip}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted leading-relaxed font-medium mt-1">
                  {item.desc}
                </p>
              </div>
            </div>

            {/* Toggle Switch Button */}
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              aria-label={`Toggle ${item.label}`}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? "bg-accent" : "bg-surface-strong/60"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
