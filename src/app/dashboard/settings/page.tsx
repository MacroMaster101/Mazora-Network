import type { Metadata } from "next";
import { Link2, Monitor } from "lucide-react";
import { requireSession, getDiscordIdentity } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ConnectedAccounts } from "@/components/dashboard/connected-accounts";
import { AccountSecurity } from "@/components/dashboard/account-security";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { FormRow, Input } from "@/components/ui";
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
  let hasMinecraft = false;
  const discord = await getDiscordIdentity();
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        email = data.user.email ?? "";
        hasGoogle = data.user.identities?.some((i) => i.provider === "google") ?? false;
        // Supabase's updateUser({ password }) sets the password but does not add
        // an "email" identity for accounts that originated from OAuth, so the
        // identities list alone can't detect a password set this way. The
        // has_password metadata flag (set in updatePasswordAction) is the
        // reliable signal for that case.
        hasPassword =
          (data.user.identities?.some((i) => i.provider === "email") ?? false) ||
          Boolean(data.user.user_metadata?.has_password);
        const accountStore = getSupabaseAdmin() ?? supabase;
        const { data: minecraftAccount } = await accountStore
          .from("minecraft_accounts")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        hasMinecraft = Boolean(minecraftAccount);
      }
    }
  }

  return (
    <>
      <DashHeader title="Settings" subtitle="Manage your profile, account and preferences." />
      <div className="grid gap-5">
        <Card title="Profile">
          <ProfileForm username={session.username} displayName={session.displayName} bio={session.bio ?? ""} />
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

        <DangerZone
          username={session.username}
          initiallyLinked={hasMinecraft}
          enabled={isSupabaseConfigured()}
        />
      </div>
    </>
  );
}
