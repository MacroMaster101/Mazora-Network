"use client";

import { useState, useEffect } from "react";
import { Mail, Calendar, LifeBuoy, Info, Check, ShieldCheck, Globe, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface NotificationSettings {
  email: boolean;
  events: boolean;
  support: boolean;
}

const STORAGE_KEY = "mazora_user_notification_prefs";

export function NotificationPreferences() {
  const { toast } = useToast();
  // Default disabled (OFF) by default for external channels — only website notifications active by default
  const [prefs, setPrefs] = useState<NotificationSettings>({
    email: false,
    events: false,
    support: false,
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
            email: parsed.email ?? false,
            events: parsed.events ?? false,
            support: parsed.support ?? false,
          });
        }
      } catch {
        // Fallback to default OFF for external channels
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
      events: "Event Alerts",
      support: "Support Notifications",
    };

    toast(
      `${labelMap[key]} ${nextState ? "enabled (ON)" : "disabled (OFF)"}.`,
      nextState ? "success" : "info"
    );
  };

  const notificationItems = [
    {
      id: "email" as const,
      label: "Email Notifications (Store & System)",
      icon: Mail,
      desc: "Receive email updates for order confirmations, store receipts, and password resets.",
      tooltip: "DISABLED by default to keep your inbox clean. Turn ON if you want email receipts for purchases.",
      exception: "Welcome email is always sent on registration.",
    },
    {
      id: "events" as const,
      label: "Event & Realm Alerts",
      icon: Calendar,
      desc: "Get alerts for server community events, double XP weekend drops, and tournament announcements.",
      tooltip: "DISABLED by default. Enable to receive event & realm maintenance alerts.",
    },
    {
      id: "support" as const,
      label: "Support Ticket & Appeal Emails",
      icon: LifeBuoy,
      desc: "Receive external notifications when staff members reply to your tickets, ban appeals, or bug reports.",
      tooltip: "DISABLED by default. Enable to get external email alerts when staff reply to your tickets.",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Information Banner Explaining Default Off & Website Always Active */}
      <div className="p-4 rounded-2xl border border-accent/30 bg-accent/10 dark:bg-accent/15 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-accent-bright">
          <Info size={16} />
          <span>Notification Channel Defaults & Preferences</span>
        </div>
        <p className="text-xs text-ink/80 dark:text-gray-300 font-medium leading-relaxed">
          By default, all external notifications (Email receipts, Event alerts, Support emails) are <strong className="text-ink dark:text-white font-extrabold">DISABLED</strong> to protect your inbox from unwanted messages. Only <strong className="text-accent-bright font-extrabold">Website In-App Notifications</strong> are active by default. (Exception: The initial Welcome Email is delivered upon registration).
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl animate-fade-in">
          <Check size={14} /> Notification preferences updated live!
        </div>
      )}

      {/* Website Notifications — Always Active Card */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 dark:bg-emerald-950/30">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <Globe size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink dark:text-emerald-300">Website In-App Notifications</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Active Default
              </span>
            </div>
            <p className="text-xs text-ink/70 dark:text-emerald-200/70 leading-relaxed font-medium mt-1">
              Delivered directly to your header notification bell and dashboard feed while browsing Mazora Network.
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0 pt-2 flex items-center gap-1">
          <ShieldCheck size={14} /> Always On
        </span>
      </div>

      {/* External Optional Channels (Disabled by default) */}
      {notificationItems.map((item) => {
        const Icon = item.icon;
        const enabled = prefs[item.id];

        return (
          <div
            key={item.id}
            className={`group relative flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all duration-200 ${
              enabled
                ? "bg-card border-line-strong dark:border-line hover:border-accent/40 shadow-xs"
                : "bg-card/70 border-line-strong/60 dark:border-line/40"
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${
                  enabled
                    ? "bg-accent/15 text-accent-bright border-accent/25"
                    : "bg-surface text-muted border-line-strong/40"
                }`}
              >
                <Icon size={18} />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{item.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                      enabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                        : "bg-surface text-muted border-line-strong/40"
                    }`}
                  >
                    {enabled ? "ON" : "OFF (Default)"}
                  </span>

                  {/* Tooltip trigger icon & popup */}
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

                    {/* Tooltip popup — positioned cleanly below to prevent covering card title */}
                    {activeTooltip === item.id && (
                      <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 p-3 rounded-xl bg-ink text-white text-xs leading-relaxed shadow-2xl border border-line-strong z-[100] animate-fade-in pointer-events-none">
                        <p className="font-bold text-accent-bright mb-1 flex items-center gap-1">
                          <Info size={13} /> {item.label} Info
                        </p>
                        <p className="text-gray-200 font-medium">{item.tooltip}</p>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted leading-relaxed font-medium mt-1">
                  {item.desc}
                </p>

                {item.exception && (
                  <p className="text-[11px] text-accent-bright font-semibold mt-1 flex items-center gap-1">
                    <Sparkles size={11} /> {item.exception}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle Switch Button */}
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              aria-label={`Toggle ${item.label}`}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? "bg-accent" : "bg-surface-strong/80 dark:bg-surface-strong/60"
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
