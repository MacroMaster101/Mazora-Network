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
import { relativeTime } from "@/lib/utils";

export interface NotificationItem extends Omit<AccountNotification, "createdAt" | "category" | "sender"> {
  time: string;
  category: NotificationCategory;
  sender: NotificationSender;
}

export const NOTIFICATIONS_UPDATED_EVENT = "mazora_notifs_updated";

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
