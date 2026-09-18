import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { FORUMS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { openReportCountsByForum } from "@/lib/data/forum-reports";
import { getForumBoard } from "@/lib/data/forums";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ForumManager } from "@/components/admin/forum-manager";

export const metadata: Metadata = { title: "Forums · Admin" };

export default async function AdminForumsPage() {
  await requireModuleAccess(FORUMS_PERMISSION_KEY, "/admin/forums");
  const [categories, reportCounts] = await Promise.all([getForumBoard(), openReportCountsByForum()]);
  const openReports = Object.values(reportCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-6">
      <DashHeader
        title="Community forums"
        subtitle="Create the categories and forums shown on /forums, rename them, set their order, lock discussions that should stop accepting posts, and delete forums you no longer need."
        action={
          <Link href="/admin/forums/reports" className={openReports ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>
            <Flag size={15} aria-hidden="true" /> Reports{openReports ? ` (${openReports})` : ""}
          </Link>
        }
      />
      <ForumManager categories={categories} reportCounts={reportCounts} />
    </div>
  );
}
