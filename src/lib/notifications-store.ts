"use client";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  category: "welcome" | "system" | "support" | "security";
  read: boolean;
  sender: "mazora" | "staff" | "system";
}

export const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-welcome",
    title: "🎉 Welcome to Mazora Network",
    message: "Your account is active. Connect to mc.mazora.us to claim your starter pack and explore survival mode!",
    time: "Just now",
    category: "welcome",
    read: false,
    sender: "mazora",
  },
  {
    id: "notif-security",
    title: "🔒 Session Verification",
    message: "Your login session was verified successfully. If you suspect unauthorized activity, change your password in account settings.",
    time: "1d ago",
    category: "security",
    read: false,
    sender: "mazora",
  },
];

const NOTIFS_KEY = "mazora_user_notifications_v4";

export function getStoredNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATIONS;
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fallback to default
  }
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
  } catch {}
  return DEFAULT_NOTIFICATIONS;
}

export function saveStoredNotifications(items: NotificationItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("mazora_notifs_updated"));
  } catch {}
}
