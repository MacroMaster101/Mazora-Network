import type { Metadata } from "next";
import { NOTIFICATIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { listAccounts } from "@/lib/data/accounts";
import { listNotificationBroadcasts } from "@/lib/data/notification-broadcasts";
import { listNotificationTemplates } from "@/lib/data/notification-templates";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminBroadcastManager } from "@/components/admin/admin-broadcast-manager";

export const metadata: Metadata = { title: "Notifications · Admin" };

export default async function AdminNotificationsPage() {
  await requireModuleAccess(NOTIFICATIONS_PERMISSION_KEY, "/admin/notifications");
  const [accounts, broadcasts, templates] = await Promise.all([
    listAccounts(),
    listNotificationBroadcasts(),
    listNotificationTemplates(),
  ]);

  const users = (accounts ?? []).map((a) => ({
    id: a.userId,
    username: a.username,
    displayName: a.displayName,
    role: a.role,
  }));

  return (
    <>
      <DashHeader title="Notifications" subtitle="Compose and broadcast announcements, events, and system notifications across the network." />
      <AdminBroadcastManager users={users} broadcasts={broadcasts} templates={templates} />
    </>
  );
}
