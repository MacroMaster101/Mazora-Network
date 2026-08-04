import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAdminVoteSites } from "@/lib/data/voting";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { Metric } from "@/components/admin/control-room";
import { VotingSitesEditor } from "@/components/admin/voting-sites-editor";

export const metadata: Metadata = { title: "Voting · Admin" };

export default async function AdminVotingPage() {
  await requireRole("administrator", "/admin/voting");
  const sites = await getAdminVoteSites();

  const activeCount = sites.filter((s) => s.enabled).length;
  const disabledCount = sites.length - activeCount;

  return (
    <div className="space-y-6">
      <DashHeader
        title="Voting desk"
        subtitle="Manage partner vote sites, rewards, cooldowns, and active status."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Vote Partners"
          value={String(sites.length)}
          detail="Total configured"
          live={sites.length > 0}
        />
        <Metric
          label="Active Sites"
          value={String(activeCount)}
          detail="Publicly listed"
          live={activeCount > 0}
        />
        <Metric
          label="Paused Sites"
          value={String(disabledCount)}
          detail="Disabled / Hidden"
          live={false}
        />
        <Metric
          label="Default Cooldown"
          value="24h"
          detail="Cycle reset"
          live
        />
      </div>

      <VotingSitesEditor sites={sites} />
    </div>
  );
}
