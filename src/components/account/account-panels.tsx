/**
 * Personal-account panels, shared by the member area (/dashboard/*) and the
 * staff area (/admin/account/*). Both render the exact same UI — a staff member
 * manages their own account here just like a regular member does.
 */
/*
  This file reaches for the service-role Supabase client (getSupabaseAdmin
  below), which must never be bundled for the browser. It lives under
  components/ rather than lib/, where a "use client" directive is only ever one
  edit away, so the boundary is asserted rather than assumed: "server-only"
  turns that mistake into a build error instead of a leaked key.
*/
import "server-only";
import type { ReactNode } from "react";
import { Monitor, Receipt } from "lucide-react";
import { requireSession, getDiscordIdentity, getSessionUserId } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/data/orders";
import { OrderCard } from "@/components/shared/order-card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";
import { ConnectedAccounts } from "@/components/dashboard/connected-accounts";
import { AccountSecurity } from "@/components/dashboard/account-security";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { ProfileAvatarEditor } from "@/components/dashboard/profile-avatar-editor";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { FormRow, Input } from "@/components/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationPreferences } from "@/components/account/notification-preferences";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Full account settings: profile, password, connected accounts, delete account. */
export async function AccountSettings({ loginNext = "/dashboard/settings" }: { loginNext?: string } = {}) {
  const session = await requireSession(loginNext);

  // Fetch user email & linked providers for the Connected Accounts card.
  let email = "";
  let hasGoogle = false;
  let hasPassword = false;
  let minecraftIdentity: { username: string; uuid: string; linkedAt: string; skinUrl: string | null } | null = null;
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
        // Mirrors accountHasPassword() in src/lib/actions/auth.ts. app_metadata is
        // where the flag is written now (only the service role can set it);
        // user_metadata is still read so accounts flagged before that change
        // keep showing the current-password field.
        hasPassword =
          (data.user.identities?.some((i) => i.provider === "email") ?? false) ||
          data.user.app_metadata?.has_password === true ||
          Boolean(data.user.user_metadata?.has_password);
        const accountStore = getSupabaseAdmin() ?? supabase;
        const { data: minecraftAccount } = await accountStore
          .from("minecraft_accounts")
          .select("id,minecraft_uuid,minecraft_username,linked_at,skin_head_url")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (minecraftAccount) {
          minecraftIdentity = {
            username: String(minecraftAccount.minecraft_username),
            uuid: String(minecraftAccount.minecraft_uuid),
            linkedAt: String(minecraftAccount.linked_at),
            skinUrl: minecraftAccount.skin_head_url ? String(minecraftAccount.skin_head_url) : null,
          };
        }
      }
    }
  }

  return (
    <>
      <DashHeader title="Settings" subtitle="Manage your profile, account and preferences." />
      <div className="grid gap-5">
        <Card title="Profile">
          <ProfileAvatarEditor
            displayName={session.displayName}
            username={session.username}
            email={email}
            avatarUrl={session.avatarUrl}
            hasDiscordPhoto={Boolean(discord?.avatarUrl)}
            enabled={isSupabaseConfigured()}
          />
          <div className="profile-avatar-divider" />
          <ProfileForm username={session.username} displayName={session.displayName} bio={session.bio ?? ""} />
        </Card>

        <Card title="Account">
          <FormRow label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} disabled />
          </FormRow>
          <AccountSecurity hasPassword={hasPassword} />
        </Card>

        <Card title="Connected accounts">
          <p className="-mt-2 text-xs text-muted">
            Manage sign-in providers and connected accounts. Discord supports login and store orders. Set your Minecraft name — premium, TLauncher or cracked — for your skin photo and player stats.
          </p>
          <ConnectedAccounts
            email={email}
            hasGoogle={hasGoogle}
            initialDiscord={discord}
            initialMinecraft={minecraftIdentity}
          />
        </Card>

        <Card title="Preferences">
          <div className="flex items-center justify-between pb-3 border-b border-line-strong/40">
            <div>
              <span className="text-sm font-bold text-ink block">Theme Preference</span>
              <span className="text-xs text-muted font-medium">Switch between sleek dark mode and light theme</span>
            </div>
            <ThemeToggle />
          </div>

          <div className="pt-2 scroll-mt-20" id="notification-settings">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Notification Settings</h3>
            <NotificationPreferences role={session.role} />
          </div>
        </Card>

        <Card title="Security">
          <div className="flex items-center gap-3 text-sm text-muted">
            <Monitor size={16} /> Active sessions and login history appear here once accounts are backed by Supabase Auth.
          </div>
          <span className="chip">Two-factor authentication · coming soon</span>
        </Card>

        <DangerZone username={session.username} enabled={isSupabaseConfigured()} />
      </div>
    </>
  );
}

import { AccountNotificationsFeed } from "@/components/account/account-notifications-feed";

/** The signed-in user's own notifications feed. */
export function AccountNotifications() {
  return <AccountNotificationsFeed />;
}

/** The signed-in user's own purchase history. */
export async function AccountPurchases() {
  const userId = await getSessionUserId();
  const orders = userId ? await getOrdersForUser(userId) : [];

  return (
    <>
      <DashHeader
        title="Purchase history"
        subtitle={
          orders.length
            ? `${orders.length} order${orders.length === 1 ? "" : "s"} placed with the Mazora store.`
            : "Your store order requests."
        }
      />
      {orders.length === 0 ? (
        <DashEmpty
          icon={<Receipt size={24} />}
          title="No orders yet"
          message="Order requests you send from the store appear here, along with the status staff set in Discord."
          cta={{ label: "Visit the store", href: "/store" }}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}
