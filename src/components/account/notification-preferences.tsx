"use client";

import { useState, useEffect } from "react";
import { Mail, Calendar, LifeBuoy, Info, Check, ShieldCheck, Globe, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { isStaff } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

interface NotificationSettings {
  email: boolean;
  events: boolean;
  support: boolean;
}

const STORAGE_KEY = "mazora_user_notification_prefs";

export function NotificationPreferences({ role }: { role?: Role | string }) {
  const { toast } = useToast();
  const isStaffUser = role ? isStaff(role as Role) : false;

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
      label: "Email Notifications (Store & Account)",
      icon: Mail,
      desc: "Receive email notifications for store orders, purchase receipts, and password resets.",
      tooltip: "Turn ON if you would like email receipts and order confirmations sent to your email inbox.",
      adminNote: "Staff & Admin Note: Welcome email is automatically sent on account registration.",
    },
    {
      id: "events" as const,
      label: "Event & Realm Alerts",
      icon: Calendar,
      desc: "Get notifications for community events, double XP weekend drops, and realm announcements.",
      tooltip: "Turn ON to receive email alerts for server events and double XP weekends.",
    },
    {
      id: "support" as const,
      label: "Support Ticket & Appeal Emails",
      icon: LifeBuoy,
      desc: "Receive email updates when staff members reply to your support tickets or ban appeals.",
      tooltip: "Turn ON to receive an email alert whenever staff reply to your ticket.",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Information Banner Explaining Default Off & Website Always Active */}
      <div className="p-4 rounded-2xl border border-accent/30 bg-accent/10 dark:bg-accent/15 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-accent-bright">
          <Info size={16} />
          <span>Notification Delivery Preferences</span>
        </div>
        <p className="text-xs text-ink/80 dark:text-gray-300 font-medium leading-relaxed">
          Manage your notification channel preferences. <strong className="text-accent-bright font-extrabold">Website In-App Notifications</strong> are active by default so you stay updated while browsing. External email and event alerts can be enabled below anytime.
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
                    {enabled ? "ON" : "OFF"}
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

                    {/* Tooltip popup */}
                    {activeTooltip === item.id && (
                      <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 p-3.5 rounded-xl bg-white dark:bg-[#1a1028] text-xs leading-relaxed shadow-2xl border border-gray-300 dark:border-line-strong z-[100] animate-fade-in pointer-events-none">
                        <p className="font-bold text-purple-700 dark:text-accent-bright mb-1 flex items-center gap-1">
                          <Info size={13} /> {item.label} Info
                        </p>
                        <p className="text-gray-800 dark:text-gray-200 font-medium">{item.tooltip}</p>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted leading-relaxed font-medium mt-1">
                  {item.desc}
                </p>

                {/* Permission-gated Staff/Admin Note */}
                {isStaffUser && item.adminNote && (
                  <p className="text-[11px] text-accent-bright font-semibold mt-1.5 flex items-center gap-1">
                    <Sparkles size={11} /> {item.adminNote}
                  </p>
                )}
              </div>
            </div>

            {/* High Contrast Toggle Switch Button */}
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              aria-label={`Toggle ${item.label}`}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled
                  ? "bg-accent border-accent/60 shadow-md shadow-accent/20"
                  : "bg-gray-300 dark:bg-zinc-800 border-gray-400 dark:border-zinc-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                  enabled
                    ? "translate-x-5 bg-white border border-white"
                    : "translate-x-0 bg-white dark:bg-gray-200 border border-gray-300 dark:border-gray-500"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
