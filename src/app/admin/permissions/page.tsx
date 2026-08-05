import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import {
  ALWAYS_ALLOWED,
  getNewsPermissions,
  getGalleryPermissions,
  getTicketsPermissions,
  getAppealsPermissions,
  getReportsPermissions,
  getBugsPermissions,
  getSuggestionsPermissions,
  getEventsPermissions,
  getGameModesPermissions,
  getStorePermissions,
  getRulesPermissions,
  getNotificationsPermissions,
} from "@/lib/auth/permissions";
import {
  saveNewsPermissionsAction,
  saveGalleryPermissionsAction,
  saveTicketsPermissionsAction,
  saveAppealsPermissionsAction,
  saveReportsPermissionsAction,
  saveBugsPermissionsAction,
  saveSuggestionsPermissionsAction,
  saveEventsPermissionsAction,
  saveGameModesPermissionsAction,
  saveStorePermissionsAction,
  saveRulesPermissionsAction,
  saveNotificationsPermissionsAction,
} from "@/lib/actions/permissions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PermissionsEditor } from "@/components/admin/permissions-editor";

export const metadata: Metadata = { title: "Permissions · Admin" };

export default async function AdminPermissionsPage() {
  await requireRole("owner", "/admin/permissions");

  const [
    newsPerms,
    galleryPerms,
    ticketsPerms,
    appealsPerms,
    reportsPerms,
    bugsPerms,
    suggestionsPerms,
    eventsPerms,
    gameModesPerms,
    storePerms,
    rulesPerms,
    notificationsPerms,
  ] = await Promise.all([
    getNewsPermissions(),
    getGalleryPermissions(),
    getTicketsPermissions(),
    getAppealsPermissions(),
    getReportsPermissions(),
    getBugsPermissions(),
    getSuggestionsPermissions(),
    getEventsPermissions(),
    getGameModesPermissions(),
    getStorePermissions(),
    getRulesPermissions(),
    getNotificationsPermissions(),
  ]);

  const staffRoles = ROLES.filter((r) => hasAtLeast(r, "helper"));

  return (
    <>
      <DashHeader title="Permissions" subtitle="Control which staff roles can manage site content, store items, moderation queues and network tools." />
      <div className="space-y-6">
        <PermissionsEditor
          title="Who can manage announcements & news"
          description="These roles can import, edit, approve, publish, and delete news posts."
          staffRoles={staffRoles}
          selected={newsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={newsPerms.userIds}
          saveAction={saveNewsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage gallery screenshots & moderation queue"
          description="These roles can approve pending player screenshots, upload screenshots directly, edit metadata, and delete entries."
          staffRoles={staffRoles}
          selected={galleryPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={galleryPerms.userIds}
          saveAction={saveGalleryPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage support tickets"
          description="These roles can view all support tickets, assign staff members, reply, change status, and delete ticket threads."
          staffRoles={staffRoles}
          selected={ticketsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={ticketsPerms.userIds}
          saveAction={saveTicketsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage ban & punishment appeals"
          description="These roles can review player ban appeals, request additional evidence, approve unbans, or reject appeals."
          staffRoles={staffRoles}
          selected={appealsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={appealsPerms.userIds}
          saveAction={saveAppealsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage player reports"
          description="These roles can review rule violation reports submitted against players, take moderation action, and resolve cases."
          staffRoles={staffRoles}
          selected={reportsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={reportsPerms.userIds}
          saveAction={saveReportsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage bug reports"
          description="These roles can review player bug submissions, set priority flags, mark bugs as fixed or in progress."
          staffRoles={staffRoles}
          selected={bugsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={bugsPerms.userIds}
          saveAction={saveBugsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage community suggestions"
          description="These roles can review community feature requests, approve suggestions for roadmap implementation, or decline them."
          staffRoles={staffRoles}
          selected={suggestionsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={suggestionsPerms.userIds}
          saveAction={saveSuggestionsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage server events & schedules"
          description="These roles can create upcoming server event listings, update event times, set reward information, and cancel events."
          staffRoles={staffRoles}
          selected={eventsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={eventsPerms.userIds}
          saveAction={saveEventsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage game modes & server listings"
          description="These roles can update game mode descriptions, feature lists, version compatibility, and server connection IPs."
          staffRoles={staffRoles}
          selected={gameModesPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={gameModesPerms.userIds}
          saveAction={saveGameModesPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage store products & packages"
          description="These roles can manage webstore packages, ranks, keys, pricing, and category organization."
          staffRoles={staffRoles}
          selected={storePerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={storePerms.userIds}
          saveAction={saveStorePermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage server rules & policies"
          description="These roles can edit network rules, community guidelines, punishment severity tiers, and staff policies."
          staffRoles={staffRoles}
          selected={rulesPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={rulesPerms.userIds}
          saveAction={saveRulesPermissionsAction}
        />

        <PermissionsEditor
          title="Who can broadcast system notifications"
          description="These roles can compose and send network-wide or targeted notification broadcasts to users and staff tiers."
          staffRoles={staffRoles}
          selected={notificationsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={notificationsPerms.userIds}
          saveAction={saveNotificationsPermissionsAction}
        />
      </div>
    </>
  );
}

