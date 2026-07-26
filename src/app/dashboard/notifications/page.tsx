import type { Metadata } from "next";
import { AccountNotifications } from "@/components/account/account-panels";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <AccountNotifications />;
}
