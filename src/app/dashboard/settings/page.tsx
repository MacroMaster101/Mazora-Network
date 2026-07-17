import type { Metadata } from "next";
import { AlertTriangle, Link2, Monitor } from "lucide-react";
import { requireSession, getDiscordIdentity } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ConnectedAccounts } from "@/components/dashboard/connected-accounts";
import { AccountSecurity } from "@/components/dashboard/account-security";
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

  // Fetch user email & linked providers for the Connected Accounts card.
  let email = "";
  let hasGoogle = false;
  let hasPassword = false;
  const discord = await getDiscordIdentity();
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        email = data.user.email ?? "";
        hasGoogle = data.user.identities?.some((i) => i.provider === "google") ?? false;
        hasPassword = data.user.identities?.some((i) => i.provider === "email") ?? false;
      }
    }
  }

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
            <Input id="email" type="email" value={email} disabled />
          </FormRow>
          <div className="flex flex-wrap items-start gap-3">
            <AccountSecurity hasPassword={hasPassword} />
            <a href="/dashboard/minecraft" className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold transition hover:border-accent/50 hover:text-accent-bright">
              <Link2 size={13} /> Minecraft linking
            </a>
          </div>
        </Card>

        <Card title="Connected accounts">
          <p className="-mt-2 text-xs text-muted">Sign in with any of these providers. Linking Discord lets you use it for orders and login.</p>
          <ConnectedAccounts email={email} hasGoogle={hasGoogle} initialDiscord={discord} />
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
