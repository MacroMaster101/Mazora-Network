import type { Metadata } from "next";
import { NOTIFICATIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { listAccounts } from "@/lib/data/accounts";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminBroadcastManager } from "@/components/admin/admin-broadcast-manager";

export const metadata: Metadata = { title: "Notifications · Admin" };

export default async function AdminNotificationsPage() {
  await requireModuleAccess(NOTIFICATIONS_PERMISSION_KEY, "/admin/notifications");
  const accounts = await listAccounts();

  const users = (accounts ?? []).map((a) => ({
    id: a.userId,
    username: a.username,
    displayName: a.displayName,
    role: a.role,
  }));

  return (
    <>
      <DashHeader title="Notifications" subtitle="Compose and broadcast announcements, events, and system notifications across the network." />
      <AdminBroadcastManager users={users} />
    </>
  );
}
