import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AccountNotifications } from "@/components/account/account-panels";

export const metadata: Metadata = { title: "My Notifications · Admin" };

/** The staff member's OWN notifications (not the broadcast tool at /admin/notifications). */
export default async function AdminAccountNotificationsPage() {
  await requireRole("helper", "/admin/account/notifications");
  return <AccountNotifications back={{ href: "/admin/account", label: "My account" }} />;
}
