import type { Metadata } from "next";
import { getVoteSites } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import type { VoteSite } from "@/lib/types";

export const metadata: Metadata = { title: "Voting · Admin" };

export default async function AdminVotingPage() {
  const sites = await getVoteSites();
  const columns: Column<VoteSite>[] = [
    { header: "Site", cell: (v) => <span className="font-semibold">{v.name}</span> },
    { header: "Reward", cell: (v) => <span className="text-muted">{v.reward}</span> },
    { header: "Cooldown", align: "right", cell: (v) => <span className="telemetry text-muted">{v.cooldownHours}h</span> },
  ];
  return (
    <>
      <DashHeader title="Vote sites" subtitle={`${sites.length} listings`} />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={sites} />
    </>
  );
}
