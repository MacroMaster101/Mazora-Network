"use client";

import {
  deleteNotificationAction,
  listMyNotificationsAction,
  setAllNotificationsReadAction,
  setNotificationReadAction,
  type AccountNotification,
  type NotificationCategory,
  type NotificationSender,
} from "@/lib/actions/notifications";

export interface NotificationItem extends Omit<AccountNotification, "createdAt" | "category" | "sender"> {
  time: string;
  category: NotificationCategory;
  sender: NotificationSender;
}

export const NOTIFICATIONS_UPDATED_EVENT = "mazora_notifs_updated";

function relativeTime(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function announceUpdate() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

export async function getStoredNotifications(): Promise<NotificationItem[]> {
  const items = await listMyNotificationsAction();
  return items.map(({ createdAt, ...item }) => ({ ...item, time: relativeTime(createdAt) }));
}

export async function setNotificationRead(id: string, read: boolean) {
  const result = await setNotificationReadAction(id, read);
  if (result.ok) announceUpdate();
  return result;
}

export async function setAllNotificationsRead(read: boolean) {
  const result = await setAllNotificationsReadAction(read);
  if (result.ok) announceUpdate();
  return result;
}

export async function deleteNotification(id?: string) {
  const result = await deleteNotificationAction(id);
  if (result.ok) announceUpdate();
  return result;
}
