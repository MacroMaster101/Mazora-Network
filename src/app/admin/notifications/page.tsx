import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Notifications · Admin" };

export default function AdminNotificationsPage() {
  return (
    <>
      <DashHeader title="Notifications" subtitle="Broadcast announcements to users." />
      <AdminPlaceholder
        icon={<Bell size={24} />}
        title="Broadcast tools arrive with the database"
        message="Send targeted notifications to users, roles or the whole network once notifications are wired up."
      />
    </>
  );
}
