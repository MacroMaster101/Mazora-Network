import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { listAccounts } from "@/lib/data/accounts";
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
  getMinecraftPermissions,
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
  saveMinecraftPermissionsAction,
} from "@/lib/actions/permissions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PermissionsManager, type PermissionModuleConfig } from "@/components/admin/permissions-editor";

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
    minecraftPerms,
    accounts,
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
    getMinecraftPermissions(),
    listAccounts(),
  ]);

  const staffRoles = ROLES.filter((r) => hasAtLeast(r, "helper"));
  const allAccounts = accounts ?? [];

  const modules: PermissionModuleConfig[] = [
    {
      id: "news",
      category: "Content",
      title: "Who can manage announcements & news",
      description: "These roles can import, edit, approve, publish, and delete news posts.",
      selected: newsPerms.roles,
      userIds: newsPerms.userIds,
      saveAction: saveNewsPermissionsAction,
    },
    {
      id: "gallery",
      category: "Content",
      title: "Who can manage gallery screenshots & moderation queue",
      description: "These roles can approve pending player screenshots, upload screenshots directly, edit metadata, and delete entries.",
      selected: galleryPerms.roles,
      userIds: galleryPerms.userIds,
      saveAction: saveGalleryPermissionsAction,
    },
    {
      id: "tickets",
      category: "Community",
      title: "Who can manage support tickets",
      description: "These roles can view all support tickets, assign staff members, reply, change status, and delete ticket threads.",
      selected: ticketsPerms.roles,
      userIds: ticketsPerms.userIds,
      saveAction: saveTicketsPermissionsAction,
    },
    {
      id: "appeals",
      category: "Community",
      title: "Who can manage ban & punishment appeals",
      description: "These roles can review player ban appeals, request additional evidence, approve unbans, or reject appeals.",
      selected: appealsPerms.roles,
      userIds: appealsPerms.userIds,
      saveAction: saveAppealsPermissionsAction,
    },
    {
      id: "reports",
      category: "Community",
      title: "Who can manage player reports",
      description: "These roles can review rule violation reports submitted against players, take moderation action, and resolve cases.",
      selected: reportsPerms.roles,
      userIds: reportsPerms.userIds,
      saveAction: saveReportsPermissionsAction,
    },
    {
      id: "bugs",
      category: "Community",
      title: "Who can manage bug reports",
      description: "These roles can review player bug submissions, set priority flags, mark bugs as fixed or in progress.",
      selected: bugsPerms.roles,
      userIds: bugsPerms.userIds,
      saveAction: saveBugsPermissionsAction,
    },
    {
      id: "suggestions",
      category: "Community",
      title: "Who can manage community suggestions",
      description: "These roles can review community feature requests, approve suggestions for roadmap implementation, or decline them.",
      selected: suggestionsPerms.roles,
      userIds: suggestionsPerms.userIds,
      saveAction: saveSuggestionsPermissionsAction,
    },
    {
      id: "events",
      category: "Content",
      title: "Who can manage server events & schedules",
      description: "These roles can create upcoming server event listings, update event times, set reward information, and cancel events.",
      selected: eventsPerms.roles,
      userIds: eventsPerms.userIds,
      saveAction: saveEventsPermissionsAction,
    },
    {
      id: "gamemodes",
      category: "Content",
      title: "Who can manage game modes & server listings",
      description: "These roles can update game mode descriptions, feature lists, version compatibility, and server connection IPs.",
      selected: gameModesPerms.roles,
      userIds: gameModesPerms.userIds,
      saveAction: saveGameModesPermissionsAction,
    },
    {
      id: "store",
      category: "Commerce",
      title: "Who can manage store products & packages",
      description: "These roles can manage webstore packages, ranks, keys, pricing, and category organization.",
      selected: storePerms.roles,
      userIds: storePerms.userIds,
      saveAction: saveStorePermissionsAction,
    },
    {
      id: "rules",
      category: "Content",
      title: "Who can manage server rules & policies",
      description: "These roles can edit network rules, community guidelines, punishment severity tiers, and staff policies.",
      selected: rulesPerms.roles,
      userIds: rulesPerms.userIds,
      saveAction: saveRulesPermissionsAction,
    },
    {
      id: "notifications",
      category: "System",
      title: "Who can broadcast system notifications",
      description: "These roles can compose and send network-wide or targeted notification broadcasts to users and staff tiers.",
      selected: notificationsPerms.roles,
      userIds: notificationsPerms.userIds,
      saveAction: saveNotificationsPermissionsAction,
    },
    {
      id: "minecraft",
      category: "System",
      title: "Who can manage Minecraft IGN claims & player links",
      description: "These roles can view linked Minecraft IGNs, release claimed IGNs, and manage player account linkages across the network.",
      selected: minecraftPerms.roles,
      userIds: minecraftPerms.userIds,
      saveAction: saveMinecraftPermissionsAction,
    },
  ];

  return (
    <>
      <DashHeader title="Permissions" subtitle="Control which staff roles and individual users can manage site content, store items, moderation queues and network tools." />
      <PermissionsManager
        modules={modules}
        staffRoles={staffRoles}
        locked={ALWAYS_ALLOWED}
        allAccounts={allAccounts}
      />
    </>
  );
}

