import type { Metadata } from "next";
import { AlertTriangle, KeyRound, Link2, Monitor } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { FormRow, Input, Textarea } from "@/components/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = { title: "Settings" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const session = await requireSession("/dashboard/settings");

  return (
    <>
      <DashHeader title="Settings" subtitle="Manage your profile, account and preferences." />
      <div className="grid gap-5">
        <Card title="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Display name" htmlFor="displayName">
              <Input id="displayName" defaultValue={session.displayName} />
            </FormRow>
            <FormRow label="Username" htmlFor="username">
              <Input id="username" defaultValue={session.username} disabled />
            </FormRow>
          </div>
          <FormRow label="Bio" htmlFor="bio">
            <Textarea id="bio" rows={3} placeholder="Tell the community a little about yourself…" />
          </FormRow>
          <button className="btn btn-primary btn-sm" disabled title="Saving is enabled once the database is connected">
            Save profile
          </button>
        </Card>

        <Card title="Account">
          <FormRow label="Email" htmlFor="email">
            <Input id="email" type="email" placeholder="you@example.com" />
          </FormRow>
          <div className="flex flex-wrap gap-3">
            <span className="chip">
              <KeyRound size={13} /> Change password
            </span>
            <a href="/dashboard/minecraft" className="chip hover:border-accent/50">
              <Link2 size={13} /> Minecraft linking
            </a>
          </div>
        </Card>

        <Card title="Preferences">
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <ThemeToggle />
          </div>
          {["Email notifications", "Event notifications", "Support notifications"].map((label) => (
            <label key={label} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#8b5cf6]" />
            </label>
          ))}
        </Card>

        <Card title="Security">
          <div className="flex items-center gap-3 text-sm text-muted">
            <Monitor size={16} /> Active sessions and login history appear here once accounts are backed by Supabase Auth.
          </div>
          <span className="chip">Two-factor authentication · coming soon</span>
        </Card>

        <section className="panel border-danger/30 p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-danger">
            <AlertTriangle size={18} /> Danger zone
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-ghost btn-sm border-danger/40 text-danger" disabled title="Requires verification">
              Disconnect Minecraft
            </button>
            <button className="btn btn-ghost btn-sm border-danger/40 text-danger" disabled title="Requires verification">
              Delete account
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">Sensitive actions require additional verification and are enabled with full auth.</p>
        </section>
      </div>
    </>
  );
}
