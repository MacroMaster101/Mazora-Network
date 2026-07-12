import type { Metadata } from "next";
import { getStaff } from "@/lib/data/content";
import { PageHero, Reveal, StaffCard } from "@/components/shared";

export const metadata: Metadata = {
  title: "Staff",
  description: "Meet the team that keeps the network running, moderated, and full of great events.",
};

const order = ["Owner", "Management", "Administrators", "Developers", "Moderators", "Helpers", "Builders"];

export default async function StaffPage() {
  const staff = await getStaff();
  const groups = order
    .map((group) => ({ group, members: staff.filter((s) => s.group === group) }))
    .filter((g) => g.members.length > 0);

  return (
    <>
      <PageHero eyebrow="The team" title="The people behind the network." lead="Owners, developers, moderators and builders — the volunteers and staff who make Mazora tick." />
      <section className="section shell space-y-12">
        {groups.map((g, gi) => (
          <Reveal key={g.group} delay={gi * 0.03}>
            <h2 className="mb-5 flex items-center gap-3 font-display text-2xl font-bold">
              {g.group}
              <span className="h-px flex-1 bg-line" />
              <span className="text-sm font-normal text-muted">{g.members.length}</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {g.members.map((m) => (
                <StaffCard key={m.username} member={m} />
              ))}
            </div>
          </Reveal>
        ))}
      </section>
    </>
  );
}
