import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { listAccounts } from "@/lib/data/accounts";
import {
  ALWAYS_ALLOWED,
  getAllModulePermissions,
  NEWS_PERMISSION_KEY,
  GALLERY_PERMISSION_KEY,
  SUGGESTIONS_PERMISSION_KEY,
  EVENTS_PERMISSION_KEY,
  GAMEMODES_PERMISSION_KEY,
  STORE_PERMISSION_KEY,
  RULES_PERMISSION_KEY,
  NOTIFICATIONS_PERMISSION_KEY,
  MINECRAFT_PERMISSION_KEY,
} from "@/lib/auth/permissions";
import {
  saveNewsPermissionsAction,
  saveGalleryPermissionsAction,
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

  /*
    One query for all thirteen modules, not thirteen.

    This used to Promise.all the individual getters, which fired thirteen
    separate site_settings SELECTs at once against a five-connection pool
    (src/lib/db/client.ts), alongside listAccounts()'s own queries. They queued
    in waves through Supabase's pooler, some hit the 15s statement_timeout and
    retried, and the page sat behind the admin loading fallback for ~40s.
  */
  const [perms, accounts] = await Promise.all([getAllModulePermissions(), listAccounts()]);

  const newsPerms = perms[NEWS_PERMISSION_KEY];
  const galleryPerms = perms[GALLERY_PERMISSION_KEY];
  const suggestionsPerms = perms[SUGGESTIONS_PERMISSION_KEY];
  const eventsPerms = perms[EVENTS_PERMISSION_KEY];
  const gameModesPerms = perms[GAMEMODES_PERMISSION_KEY];
  const storePerms = perms[STORE_PERMISSION_KEY];
  const rulesPerms = perms[RULES_PERMISSION_KEY];
  const notificationsPerms = perms[NOTIFICATIONS_PERMISSION_KEY];
  const minecraftPerms = perms[MINECRAFT_PERMISSION_KEY];

  const staffRoles = ROLES.filter((r) => hasAtLeast(r, "helper"));
  // Narrowed here, not in the component: props to a Client Component are
  // serialised whether or not they are rendered. See PermissionAccount.
  const allAccounts = (accounts ?? []).map(({ userId, username, displayName, email, role }) => ({
    userId,
    username,
    displayName,
    email,
    role,
  }));

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

