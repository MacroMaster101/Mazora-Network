import type { Metadata } from "next";
import { requireRole, hasAtLeast } from "@/lib/auth";
import { site } from "@/lib/site";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ReadOnlyBanner } from "@/components/admin/admin-ui";
import { FormRow, Input } from "@/components/ui";

export const metadata: Metadata = { title: "Site Settings · Admin" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function AdminSettingsPage() {
  const session = await requireRole("it", "/admin/settings");
  const ownerOnly = hasAtLeast(session.role, "owner");

  return (
    <>
      <DashHeader title="Site settings" subtitle="Configure the network without touching code." />
      <ReadOnlyBanner note={ownerOnly ? "Owner access. Saving activates with the database (site_settings table)." : "Some settings are owner-only. Saving activates with the database."} />

      <div className="grid gap-5">
        <Card title="Identity">
          <FormRow label="Server name" htmlFor="name">
            <Input id="name" defaultValue={site.name} disabled />
          </FormRow>
          <FormRow label="Supported version" htmlFor="version">
            <Input id="version" defaultValue={site.version} disabled />
          </FormRow>
        </Card>

        <Card title="Connection">
          <FormRow label="Java IP" htmlFor="java">
            <Input id="java" defaultValue={site.javaIp} disabled />
          </FormRow>
          <FormRow label="Bedrock IP" htmlFor="bedrock">
            <Input id="bedrock" defaultValue={site.bedrockIp} disabled />
          </FormRow>
          <FormRow label="Bedrock port" htmlFor="port">
            <Input id="port" defaultValue={site.bedrockPort} disabled />
          </FormRow>
          <FormRow label="Discord invite" htmlFor="discord">
            <Input id="discord" defaultValue={site.discord} disabled />
          </FormRow>
        </Card>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Toggles</h2>
          <div className="mt-4 space-y-3">
            {[
              ["Maintenance mode", false],
              ["Registration enabled", true],
              ["Store enabled", true],
              ["Voting enabled", true],
            ].map(([label, on]) => (
              <label key={label as string} className="flex items-center justify-between">
                <span className="text-sm">{label as string}</span>
                <input type="checkbox" defaultChecked={on as boolean} disabled className="h-4 w-4 accent-[#8b5cf6]" />
              </label>
            ))}
          </div>
        </section>

        <button className="btn btn-primary btn-sm w-fit opacity-60" disabled title="Enabled with the database">
          Save settings
        </button>
      </div>
    </>
  );
}
