import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { BackLink } from "@/components/shared";
import { FORUMS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { listOpenForumReports } from "@/lib/data/forum-reports";
import { getForumBoard } from "@/lib/data/forums";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ForumReportsQueue } from "@/components/admin/forum-reports-queue";

export const metadata: Metadata = { title: "Forum Reports · Admin" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ forum?: string }> };

export default async function AdminForumReportsPage({ searchParams }: PageProps) {
  await requireModuleAccess(FORUMS_PERMISSION_KEY, "/admin/forums/reports");

  // The forum filter is only used to look a forum up; an unknown id shows every report.
  const requested = (await searchParams).forum;
  const board = await getForumBoard();
  const forum = board.flatMap((category) => category.forums).find((item) => item.id === requested);
  const reports = await listOpenForumReports(forum?.id);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/forums" label="Back to Forums" />
      <DashHeader
        title={forum ? `Reports · ${forum.name}` : "Forum reports"}
        subtitle="Posts members have flagged. Remove the post if it breaks the rules, or dismiss the reports if it doesn't — either way every open report on that post is closed and recorded in the audit log."
        action={
          forum ? (
            <Link href="/admin/forums/reports" className="btn btn-ghost btn-sm">
              Show all forums
            </Link>
          ) : undefined
        }
      />
      <ForumReportsQueue key={forum?.id ?? "all"} initialReports={reports} />
    </div>
  );
}
