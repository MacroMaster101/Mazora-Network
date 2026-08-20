import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { listAccounts } from "@/lib/data/accounts";
import {
  ALWAYS_ALLOWED,
  getAllModulePermissions,
  NEWS_PERMISSION_KEY,
  GALLERY_PERMISSION_KEY,
  PLAY_PERMISSION_KEY,
  EVENTS_PERMISSION_KEY,
  GAMEMODES_PERMISSION_KEY,
  RULES_PERMISSION_KEY,
  SUPPORT_PERMISSION_KEY,
  APPEALS_PERMISSION_KEY,
  SUGGESTIONS_PERMISSION_KEY,
  STORE_PERMISSION_KEY,
  ORDERS_PERMISSION_KEY,
  VOTING_PERMISSION_KEY,
  MINECRAFT_PERMISSION_KEY,
  USERS_PERMISSION_KEY,
  STAFF_PERMISSION_KEY,
  NOTIFICATIONS_PERMISSION_KEY,
} from "@/lib/auth/permissions";
import {
  saveNewsPermissionsAction,
  saveGalleryPermissionsAction,
  savePlayPermissionsAction,
  saveEventsPermissionsAction,
  saveGameModesPermissionsAction,
  saveRulesPermissionsAction,
  saveSupportPermissionsAction,
  saveAppealsPermissionsAction,
  saveSuggestionsPermissionsAction,
  saveStorePermissionsAction,
  saveOrdersPermissionsAction,
  saveVotingPermissionsAction,
  saveMinecraftPermissionsAction,
  saveUsersPermissionsAction,
  saveStaffPermissionsAction,
  saveNotificationsPermissionsAction,
} from "@/lib/actions/permissions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PermissionsManager, type PermissionModuleConfig } from "@/components/admin/permissions-editor";

export const metadata: Metadata = { title: "Permissions · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPermissionsPage() {
  await requireRole("owner", "/admin/permissions");

  const [perms, accounts] = await Promise.all([getAllModulePermissions(), listAccounts()]);

  const staffRoles = ROLES.filter((r) => hasAtLeast(r, "helper"));
  const allAccounts = (accounts ?? []).map(({ userId, username, displayName, email, role }) => ({
    userId,
    username,
    displayName,
    email,
    role,
  }));

  const modules: PermissionModuleConfig[] = [
    // Content Modules
    {
      id: "news",
      category: "Content",
      title: "Announcements & Newsroom",
      description: "Manage editorial drafts, publish news articles, re-host artwork, and sync Discord announcements.",
      selected: perms[NEWS_PERMISSION_KEY].roles,
      userIds: perms[NEWS_PERMISSION_KEY].userIds,
      saveAction: saveNewsPermissionsAction,
    },
    {
      id: "gallery",
      category: "Content",
      title: "Community Gallery & Moderation",
      description: "Review pending player screenshot submissions, approve media, feature artworks, and remove content.",
      selected: perms[GALLERY_PERMISSION_KEY].roles,
      userIds: perms[GALLERY_PERMISSION_KEY].userIds,
      saveAction: saveGalleryPermissionsAction,
    },
    {
      id: "play",
      category: "Content",
      title: "Play Page & Connection Settings",
      description: "Configure server join IPs, Bedrock ports, patch note sync channels, and connection FAQs.",
      selected: perms[PLAY_PERMISSION_KEY].roles,
      userIds: perms[PLAY_PERMISSION_KEY].userIds,
      saveAction: savePlayPermissionsAction,
    },
    {
      id: "events",
      category: "Content",
      title: "Events & Tournaments",
      description: "Create upcoming server events, manage schedules, configure prize rewards, and set player caps.",
      selected: perms[EVENTS_PERMISSION_KEY].roles,
      userIds: perms[EVENTS_PERMISSION_KEY].userIds,
      saveAction: saveEventsPermissionsAction,
    },
    {
      id: "gamemodes",
      category: "Content",
      title: "Game Modes & Server Directory",
      description: "Edit game mode details, features, server addresses, version compatibility, and store linkages.",
      selected: perms[GAMEMODES_PERMISSION_KEY].roles,
      userIds: perms[GAMEMODES_PERMISSION_KEY].userIds,
      saveAction: saveGameModesPermissionsAction,
    },
    {
      id: "rules",
      category: "Content",
      title: "Server Rules & Guidelines",
      description: "Update network rule categories, policies, severity tiers, and staff enforcement notes.",
      selected: perms[RULES_PERMISSION_KEY].roles,
      userIds: perms[RULES_PERMISSION_KEY].userIds,
      saveAction: saveRulesPermissionsAction,
    },

    // Support Modules
    {
      id: "support",
      category: "Support",
      title: "Support Center & Help Cards",
      description: "Manage support hub cards, direct help links, FAQs, and detailed guide documentation pages.",
      selected: perms[SUPPORT_PERMISSION_KEY].roles,
      userIds: perms[SUPPORT_PERMISSION_KEY].userIds,
      saveAction: saveSupportPermissionsAction,
    },
    {
      id: "appeals",
      category: "Support",
      title: "Appeals & Application Intake Forms",
      description: "Toggle availability and update links for ban appeals, staff applications, and creator partner forms.",
      selected: perms[APPEALS_PERMISSION_KEY].roles,
      userIds: perms[APPEALS_PERMISSION_KEY].userIds,
      saveAction: saveAppealsPermissionsAction,
    },

    // Community Modules
    {
      id: "suggestions",
      category: "Community",
      title: "Community Suggestions",
      description: "Review player feature ideas, update status (planned, under review, declined), and triage upvotes.",
      selected: perms[SUGGESTIONS_PERMISSION_KEY].roles,
      userIds: perms[SUGGESTIONS_PERMISSION_KEY].userIds,
      saveAction: saveSuggestionsPermissionsAction,
    },
    {
      id: "minecraft",
      category: "Community",
      title: "Minecraft Players & IGN Claims",
      description: "Inspect linked player IGNs, view in-game stats, release claims, and moderate player profiles.",
      selected: perms[MINECRAFT_PERMISSION_KEY].roles,
      userIds: perms[MINECRAFT_PERMISSION_KEY].userIds,
      saveAction: saveMinecraftPermissionsAction,
    },
    {
      id: "users",
      category: "Community",
      title: "User Management & Role Directory",
      description: "View user directory, appoint ranks, send team invitations, and manage user account statuses.",
      selected: perms[USERS_PERMISSION_KEY].roles,
      userIds: perms[USERS_PERMISSION_KEY].userIds,
      saveAction: saveUsersPermissionsAction,
    },
    {
      id: "staff",
      category: "Community",
      title: "Staff Roster & Public Visibility",
      description: "Manage the official staff team ladder, toggle public visibility on /staff, and review team members.",
      selected: perms[STAFF_PERMISSION_KEY].roles,
      userIds: perms[STAFF_PERMISSION_KEY].userIds,
      saveAction: saveStaffPermissionsAction,
    },

    // Commerce Modules
    {
      id: "store",
      category: "Commerce",
      title: "Store Catalogue & Discount Codes",
      description: "Manage webstore packages, ranks, keys, pricing, discount creator promo codes, and roadmap banner.",
      selected: perms[STORE_PERMISSION_KEY].roles,
      userIds: perms[STORE_PERMISSION_KEY].userIds,
      saveAction: saveStorePermissionsAction,
    },
    {
      id: "orders",
      category: "Commerce",
      title: "Orders & Transaction Browser",
      description: "Inspect purchase history, reference numbers (MZ-...), buyer Discord IDs, and order items.",
      selected: perms[ORDERS_PERMISSION_KEY].roles,
      userIds: perms[ORDERS_PERMISSION_KEY].userIds,
      saveAction: saveOrdersPermissionsAction,
    },
    {
      id: "voting",
      category: "Commerce",
      title: "Voting Partners & Rewards",
      description: "Configure partner voting sites, reward descriptions, cooldown hours, and active status.",
      selected: perms[VOTING_PERMISSION_KEY].roles,
      userIds: perms[VOTING_PERMISSION_KEY].userIds,
      saveAction: saveVotingPermissionsAction,
    },

    // System Modules
    {
      id: "notifications",
      category: "System",
      title: "System Broadcasts & Announcements",
      description: "Compose and broadcast live push notifications across the network to users, ranks, or individual accounts.",
      selected: perms[NOTIFICATIONS_PERMISSION_KEY].roles,
      userIds: perms[NOTIFICATIONS_PERMISSION_KEY].userIds,
      saveAction: saveNotificationsPermissionsAction,
    },
  ];

  return (
    <>
      <DashHeader
        title="Permissions"
        subtitle="Control which staff roles and individual users can manage site content, store items, moderation queues and network tools."
      />
      <PermissionsManager
        modules={modules}
        staffRoles={staffRoles}
        locked={ALWAYS_ALLOWED}
        allAccounts={allAccounts}
      />
    </>
  );
}
