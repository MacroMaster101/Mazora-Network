import type { EditablePageId } from "@/lib/page-paths";

export { EDITABLE_PAGE_IDS, EDITABLE_PAGE_PATHS, editablePagePath, isEditablePageId } from "@/lib/page-paths";
export type { EditablePageId } from "@/lib/page-paths";

export interface PageContentField {
  key: string;
  label: string;
  help?: string;
  type?: "text" | "textarea";
  maxLength?: number;
}

export interface PageContentPanel {
  id: string;
  title: string;
  description: string;
  fields: PageContentField[];
}

export interface PageContentDefinition {
  id: EditablePageId;
  label: string;
  path: string;
  eyebrow: string;
  description: string;
  panels: PageContentPanel[];
  defaults: Record<string, string>;
  managerPath?: string;
  managerLabel?: string;
  permissionKey: string;
}

const field = (key: string, label: string, options: Omit<PageContentField, "key" | "label"> = {}): PageContentField => ({
  key,
  label,
  maxLength: options.type === "textarea" ? 600 : 160,
  ...options,
});

export const PAGE_CONTENT_DEFINITIONS: Record<EditablePageId, PageContentDefinition> = {
  home: {
    id: "home",
    label: "Home",
    path: "/",
    eyebrow: "Main landing page",
    description: "Edit the homepage hero controls, news band, world map copy, and final network introduction.",
    permissionKey: PLAY_PERMISSION_KEY,
    panels: [
      {
        id: "hero",
        title: "Hero & live counters",
        description: "Labels and calls to action shown around the Mazora hero artwork.",
        fields: [
          field("heroTitle", "Accessible page title"),
          field("playersOnlineLabel", "Players online label"),
          field("discordOnlineLabel", "Discord online label"),
          field("discordFallbackLabel", "Discord fallback label"),
          field("primaryCta", "Primary button"),
          field("copyIpCta", "Copy IP button"),
          field("discordCta", "Discord button"),
        ],
      },
      {
        id: "news",
        title: "Latest news",
        description: "Section heading and the message shown before the first article is published.",
        fields: [
          field("newsEyebrow", "Eyebrow"), field("newsTitle", "Section title"),
          field("newsEmptyTitle", "Empty state title"),
          field("newsEmptyMessage", "Empty state description", { type: "textarea" }),
          field("newsEmptyCta", "Empty state button"),
        ],
      },
      {
        id: "map",
        title: "World map",
        description: "Copy used above the live map and in its offline or coming-soon states.",
        fields: [
          field("mapEyebrow", "Eyebrow"), field("mapTitle", "Section title"), field("mapToolbarTitle", "Map title"),
          field("mapLiveMessage", "Live description", { type: "textarea" }),
          field("mapOfflineMessage", "Offline description", { type: "textarea" }),
          field("mapPendingMessage", "Coming soon description", { type: "textarea" }),
          field("mapOfflineTitle", "Offline card title"), field("mapPendingTitle", "Coming soon card title"),
          field("mapOfflineBody", "Offline card description", { type: "textarea" }),
          field("mapPendingBody", "Coming soon card description", { type: "textarea" }),
        ],
      },
      {
        id: "network",
        title: "Network introduction",
        description: "The final homepage story, value points, and action labels.",
        fields: [
          field("networkEyebrow", "Eyebrow"), field("networkTitle", "Section title"),
          field("networkDescription", "Description", { type: "textarea" }),
          field("valueOne", "Value point 1"), field("valueTwo", "Value point 2"), field("valueThree", "Value point 3"),
          field("networkCopyCta", "Copy IP button"), field("networkWorldsCta", "Game modes button"), field("networkDiscordCta", "Discord button"),
        ],
      },
    ],
    defaults: {
      heroTitle: "Mazora Network — Build, survive, compete and create",
      playersOnlineLabel: "Players Online", discordOnlineLabel: "Discord Online", discordFallbackLabel: "Our Discord",
      primaryCta: "Enter the world", copyIpCta: "Copy IP", discordCta: "Discord",
      newsEyebrow: "From the network", newsTitle: "Latest news & updates.", newsEmptyTitle: "No articles published yet",
      newsEmptyMessage: "Updates, patch notes and announcements from the team will show up here.", newsEmptyCta: "Join the Discord",
      mapEyebrow: "Explore Mazora", mapTitle: "See the world from above.", mapToolbarTitle: "Mazora live world map",
      mapLiveMessage: "Live terrain and player activity from across the network.",
      mapOfflineMessage: "The map reconnects automatically once the server is back online.", mapPendingMessage: "The map portal is being prepared for launch.",
      mapOfflineTitle: "The world map is resting.", mapPendingTitle: "Our world is almost online.",
      mapOfflineBody: "Live terrain and player locations return as soon as the server is back up.",
      mapPendingBody: "Explore builds, landmarks and live player locations here once the server map plugin launches.",
      networkEyebrow: "Inside the network", networkTitle: "Built to feel like your server.",
      networkDescription: "Mazora is a player-first Minecraft community built around persistent worlds, fair progression, and the people you meet along the way. Join from Java or Bedrock and keep one identity across every mode.",
      valueOne: "Fair progression", valueTwo: "Java + Bedrock", valueThree: "Active community",
      networkCopyCta: "Copy server IP", networkWorldsCta: "Explore worlds", networkDiscordCta: "Discord",
    },
  },
  news: {
    id: "news", label: "News", path: "/news", eyebrow: "Newsroom landing page", managerPath: "/admin/news", managerLabel: "Manage articles",
    description: "Edit the newsroom masthead, community note, and no-articles state.",
    permissionKey: NEWS_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Newsroom hero", description: "The masthead copy above published stories.", fields: [field("heroEyebrow", "Live pill"), field("heroTitle", "Title"), field("heroAccent", "Highlighted title"), field("heroLead", "Description", { type: "textarea" }), field("noteStrong", "Note emphasis"), field("noteRest", "Note description")] },
      { id: "empty", title: "Empty state", description: "Shown when no articles have been published.", fields: [field("emptyTitle", "Title"), field("emptyMessage", "Description", { type: "textarea" }), field("emptyCta", "Button label")] },
    ],
    defaults: { heroEyebrow: "Latest from Mazora", heroTitle: "Stories from", heroAccent: "across the network.", heroLead: "Discover new releases, server changes, upcoming events and the moments shaping the Mazora community.", noteStrong: "Made for our community", noteRest: "and updated by the Mazora team.", emptyTitle: "No articles published yet", emptyMessage: "Server updates, patch notes and announcements will appear here as soon as the team publishes them.", emptyCta: "Join the Discord" },
  },
  events: {
    id: "events", label: "Events", path: "/events", eyebrow: "Events landing page", managerPath: "/admin/events", managerLabel: "Manage events",
    description: "Edit the events hero and the no-events state while keeping event management separate.",
    permissionKey: EVENTS_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The introduction above the event directory.", fields: [field("heroEyebrow", "Eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "empty", title: "Empty state", description: "Shown when the schedule is empty.", fields: [field("emptyTitle", "Title"), field("emptyMessage", "Description", { type: "textarea" }), field("emptyCta", "Button label")] },
    ],
    defaults: { heroEyebrow: "Competitions & community", heroTitle: "There's always something happening.", heroLead: "Tournaments, build competitions, and spontaneous community nights. Show up and win something.", emptyTitle: "No events scheduled", emptyMessage: "Tournaments, build competitions and community nights will be listed here once the team schedules them.", emptyCta: "Join the Discord" },
  },
  "game-modes": {
    id: "game-modes", label: "Game Modes", path: "/game-modes", eyebrow: "World directory page", managerPath: "/admin/game-modes", managerLabel: "Manage game modes",
    description: "Edit the game-mode directory hero, live count wording, and empty state.",
    permissionKey: GAMEMODES_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "Directory heading and live world-count labels.", fields: [field("fallbackEyebrow", "Fallback eyebrow"), field("worldsSuffix", "World count suffix"), field("onlineSuffix", "Online count suffix"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "empty", title: "Empty state", description: "Shown before the first game mode is configured.", fields: [field("emptyTitle", "Title"), field("emptyMessage", "Description", { type: "textarea" }), field("emptyCta", "Button label")] },
    ],
    defaults: { fallbackEyebrow: "Game modes", worldsSuffix: "worlds", onlineSuffix: "online now", heroTitle: "Pick a world. Make it yours.", heroLead: "One shared account across every mode. Jump between them freely and carry your rank everywhere.", emptyTitle: "Game modes are being set up", emptyMessage: "Each world will be listed here with its rules, commands and live player count once it is configured.", emptyCta: "How to play" },
  },
  rules: {
    id: "rules", label: "Rules", path: "/rules", eyebrow: "Rulebook landing page", managerPath: "/admin/rules", managerLabel: "Manage rules",
    description: "Edit the rulebook introduction and its unpublished state.",
    permissionKey: RULES_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The introduction above the rule categories.", fields: [field("fallbackEyebrow", "Fallback eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "empty", title: "Empty state", description: "Shown before the rulebook is published.", fields: [field("emptyTitle", "Title"), field("emptyMessage", "Description", { type: "textarea" }), field("emptyCta", "Button label")] },
    ],
    defaults: { fallbackEyebrow: "Community rules", heroTitle: "Play fair. Have fun.", heroLead: "Our rules exist to keep the network welcoming and competitive. Read them once — they take five minutes and save a lot of headaches.", emptyTitle: "Rules are being written", emptyMessage: "The community rulebook will be published here. Until then, ask staff in Discord if you are unsure about anything.", emptyCta: "Ask in Discord" },
  },
  gallery: {
    id: "gallery", label: "Gallery", path: "/gallery", eyebrow: "Gallery landing page", managerPath: "/admin/gallery", managerLabel: "Manage artwork",
    description: "Edit the gallery introduction and artwork submission call to action.",
    permissionKey: GALLERY_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The heading above community artwork.", fields: [field("heroEyebrow", "Eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "submission", title: "Submission call to action", description: "Labels inviting players to share artwork.", fields: [field("submitCta", "Button label"), field("submitBadge", "Supporting message")] },
    ],
    defaults: { heroEyebrow: "Gallery", heroTitle: "Have a peek at what our community is up to!", heroLead: "Player builds, events, and community moments and more! Click on the image to view it in full-size.", submitCta: "Submit Artwork", submitBadge: "Share your builds with the Mazora community" },
  },
  staff: {
    id: "staff", label: "Our Team", path: "/staff", eyebrow: "Team landing page", managerPath: "/admin/staff", managerLabel: "Manage team roster",
    description: "Edit the team story, values, operating guidance, FAQs, and recruitment call to action.",
    permissionKey: STAFF_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero & values", description: "The introduction and three value cards at the top of the page.", fields: [field("heroEyebrow", "Eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" }), ...Array.from({ length: 3 }, (_, i) => [field(`value${i + 1}Title`, `Value ${i + 1} title`), field(`value${i + 1}Copy`, `Value ${i + 1} description`, { type: "textarea" })]).flat()] },
      { id: "hierarchy", title: "Team hierarchy", description: "Heading above the live public staff roster.", fields: [field("hierarchyEyebrow", "Eyebrow"), field("hierarchyTitle", "Title"), field("countSuffix", "Team count suffix"), field("unavailableTitle", "Unavailable title"), field("unavailableBody", "Unavailable description"), field("emptyTitle", "Empty roster title"), field("emptyBody", "Empty roster description", { type: "textarea" })] },
      { id: "operations", title: "How we operate", description: "The team escalation path and support guidance.", fields: [field("operationsEyebrow", "Operations eyebrow"), field("operationsTitle", "Operations title"), field("operationsBody", "Operations description", { type: "textarea" }), field("helpEyebrow", "Help eyebrow"), field("helpTitle", "Help title"), field("helpBody", "Help description", { type: "textarea" })] },
      { id: "applications", title: "Applications", description: "Recruitment explanation and expectations.", fields: [field("applicationsEyebrow", "Eyebrow"), field("applicationsTitle", "Title"), field("applicationsBody", "Description", { type: "textarea" }), field("applicationsAsk", "What the application asks", { type: "textarea" }), field("applicationsLook", "What the team looks for", { type: "textarea" })] },
      { id: "faq", title: "Team FAQs", description: "Three public questions used on the page and in structured search data.", fields: [field("faqEyebrow", "Eyebrow"), field("faqTitle", "Title"), ...Array.from({ length: 3 }, (_, i) => [field(`faq${i + 1}Question`, `Question ${i + 1}`), field(`faq${i + 1}Answer`, `Answer ${i + 1}`, { type: "textarea" })]).flat()] },
      { id: "cta", title: "Recruitment call to action", description: "The final invitation and button labels.", fields: [field("ctaEyebrow", "Eyebrow"), field("ctaTitle", "Title"), field("ctaBody", "Description", { type: "textarea" }), field("discordCta", "Discord button"), field("applicationsCta", "Applications button")] },
    ],
    defaults: {
      heroEyebrow: "Our Team", heroTitle: "Meet the Mazora Team", heroLead: "The people behind every update, event, support request, and safe adventure across the Mazora Network. Mazora is community-run — every member of the team is a volunteer from the player community.",
      value1Title: "Our Mission", value1Copy: "Build memorable experiences, improve the network, and make every player's journey worth returning to.", value2Title: "Safe & Fair", value2Copy: "Protect the community, apply the rules consistently, and give every report the attention it deserves.", value3Title: "Community First", value3Copy: "Listen to player feedback, offer clear support, and create a welcoming place for everyone to play.",
      hierarchyEyebrow: "Network hierarchy", hierarchyTitle: "Meet the team, from leadership to community.", countSuffix: "team members", unavailableTitle: "Team directory is temporarily unavailable", unavailableBody: "Please check back shortly.", emptyTitle: "Our team profiles are being prepared", emptyBody: "Staff members will appear here as their public profiles are enabled.",
      operationsEyebrow: "How we operate", operationsTitle: "Five ranks, one escalation path", operationsBody: "Every issue enters the team through support and moves up only as far as it needs to. Helpers answer everyday questions, moderators review conduct, senior moderators handle complex cases, administrators own operations, and ownership sets direction.", helpEyebrow: "Getting help", helpTitle: "How to reach us", helpBody: "Player reports, bugs, and store issues belong in a private support ticket. Appeals and applications use official forms, while feature suggestions stay public so the community can vote.",
      applicationsEyebrow: "Grow with us", applicationsTitle: "How staff applications work", applicationsBody: "Mazora is community-run. If you are patient, dependable, and excited to help players, use the official application form whenever recruitment is open.", applicationsAsk: "The form asks for your Minecraft username, age, timezone, availability, relevant experience, the role you want, and how you will help players.", applicationsLook: "We look for consistent activity, a clean record, patience, accuracy, and a calm tone. Prior experience is useful context, not a shortcut.",
      faqEyebrow: "Common questions", faqTitle: "About the team", faq1Question: "Do Mazora Network staff members get paid?", faq1Answer: "No. Mazora is community-run, and every member of the team is a volunteer from the player community.", faq2Question: "How do I become a staff member on Mazora Network?", faq2Answer: "Apply through the official staff application form. Applications are reviewed by staff management, and the form shows as closed when recruitment is paused.", faq3Question: "Will Mazora staff ever ask for my password?", faq3Answer: "No. Staff will never ask for your password, recovery codes, or full payment details.",
      ctaEyebrow: "Grow with us", ctaTitle: "Want to help shape the next chapter?", ctaBody: "Join the community, get involved, and watch for future staff opportunities.", discordCta: "Join Discord", applicationsCta: "Staff applications",
    },
  },
  vote: {
    id: "vote", label: "Vote", path: "/vote", eyebrow: "Voting landing page", managerPath: "/admin/voting", managerLabel: "Manage vote sites",
    description: "Edit the voting mission, leaderboard introduction, site guide, steps, and reward note.",
    permissionKey: VOTING_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Voting hero", description: "Status labels, headline, introduction, and actions.", fields: [field("openLabel", "Open status"), field("pausedLabel", "Paused status"), field("cycleLabel", "Cycle label"), field("partnerStat", "Partner metric"), field("supporterStat", "Supporter metric"), field("heroEyebrow", "Eyebrow"), field("heroTitle", "Title"), field("heroAccent", "Highlighted title"), field("heroLead", "Description", { type: "textarea" }), field("pausedMessage", "Paused message", { type: "textarea" }), field("primaryCta", "Primary button"), field("secondaryCta", "Secondary button")] },
      { id: "journey", title: "Voting journey", description: "The three short steps below the hero actions.", fields: [field("journeyOne", "Step 1"), field("journeyTwo", "Step 2"), field("journeyThree", "Step 3")] },
      { id: "center", title: "Vote center & leaderboard", description: "Headings above voting partners and supporter rankings.", fields: [field("centerEyebrow", "Center eyebrow"), field("centerTitle", "Center title"), field("centerLead", "Center description", { type: "textarea" }), field("leaderEyebrow", "Leaderboard eyebrow"), field("leaderTitle", "Leaderboard title"), field("leaderLead", "Leaderboard description", { type: "textarea" })] },
      { id: "sites", title: "Vote sites & guide", description: "Partner list heading, cooldown note, and guide heading.", fields: [field("sitesEyebrow", "Sites eyebrow"), field("sitesTitle", "Sites title"), field("siteFallback", "Partner fallback description"), field("cooldown", "Cooldown note"), field("guideEyebrow", "Guide eyebrow"), field("guideTitle", "Guide title")] },
      { id: "steps", title: "Guide steps & reward", description: "Detailed voting instructions and reward note.", fields: [...Array.from({ length: 3 }, (_, i) => [field(`step${i + 1}Title`, `Step ${i + 1} title`), field(`step${i + 1}Copy`, `Step ${i + 1} description`, { type: "textarea" })]).flat(), field("rewardTitle", "Reward title"), field("rewardCopy", "Reward description", { type: "textarea" })] },
    ],
    defaults: { openLabel: "Voting open", pausedLabel: "Voting paused", cycleLabel: "Daily reward cycle", partnerStat: "live vote partners", supporterStat: "supporters ranked", heroEyebrow: "Support Mazora. Earn in game.", heroTitle: "Your vote shapes", heroAccent: "what comes next.", heroLead: "Help more players discover the network and collect a configured reward for every completed partner vote.", pausedMessage: "Server voting is currently paused for scheduled updates.", primaryCta: "Vote now", secondaryCta: "View rankings", journeyOne: "Choose a partner", journeyTwo: "Enter your username", journeyThree: "Return for rewards", centerEyebrow: "Mazora vote center", centerTitle: "Choose a site. Help Mazora grow.", centerLead: "Use your Minecraft username on any available partner. Each completed vote supports the network and can unlock your configured in-game reward.", leaderEyebrow: "Community leaderboard", leaderTitle: "Top supporters", leaderLead: "Find a player or sort the board by the voting period that matters to you.", sitesEyebrow: "Available now", sitesTitle: "Vote sites", siteFallback: "Open partner and enter your username", cooldown: "Each partner controls its own voting cooldown.", guideEyebrow: "Quick guide", guideTitle: "Three steps. Done.", step1Title: "Open a partner", step1Copy: "Choose any available site from the list.", step2Title: "Confirm your username", step2Copy: "Enter the Minecraft name you use on Mazora.", step3Title: "Return to the server", step3Copy: "Collect your configured reward in game.", rewardTitle: "Rewards stay flexible", rewardCopy: "Vote rewards can change as Mazora's seasons and events evolve." },
  },
  discord: {
    id: "discord", label: "Discord", path: "/discord", eyebrow: "Community landing page",
    description: "Edit the Discord hero, join panel, and the six community benefit cards.",
    permissionKey: PLAY_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The opening message above the Discord invitation.", fields: [field("fallbackEyebrow", "Fallback eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "join", title: "Join panel", description: "The main invitation next to the live Discord widget.", fields: [field("joinTitle", "Title"), field("joinBody", "Description", { type: "textarea" }), field("joinCta", "Button label")] },
      { id: "benefits", title: "Benefit cards", description: "Titles and descriptions for the six reasons to join.", fields: Array.from({ length: 6 }, (_, i) => [field(`benefit${i + 1}Title`, `Card ${i + 1} title`), field(`benefit${i + 1}Copy`, `Card ${i + 1} description`, { type: "textarea" })]).flat() },
    ],
    defaults: {
      fallbackEyebrow: "Mazora community", heroTitle: "The community lives on Discord.", heroLead: "It's where the network really comes alive. Announcements, giveaways, teammates and support — all in one place.",
      joinTitle: "Join Mazora Network on Discord", joinBody: "Free, instant, and the fastest way to plug into everything happening on the network.", joinCta: "Join the Discord",
      benefit1Title: "Announcements first", benefit1Copy: "Updates, patch notes and maintenance windows land here before anywhere else.",
      benefit2Title: "Giveaways", benefit2Copy: "Regular drops of ranks, coins, cosmetics and crate keys for active members.",
      benefit3Title: "Event info", benefit3Copy: "Sign-ups, brackets and live results for every tournament and build contest.",
      benefit4Title: "Support", benefit4Copy: "Quick help from the community and a direct line to staff when you need it.",
      benefit5Title: "Find teammates", benefit5Copy: "LFG channels for every mode — never raid, build or compete alone.",
      benefit6Title: "Community", benefit6Copy: "Share builds, swap tips, and hang out with other Mazora players.",
    },
  },
  players: {
    id: "players", label: "Players", path: "/players", eyebrow: "Player directory",
    description: "Edit the player directory hero and its no-data message.",
    permissionKey: MINECRAFT_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The directory title and introduction.", fields: [field("fallbackEyebrow", "Fallback eyebrow"), field("onlineSuffix", "Live count suffix"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "empty", title: "Empty state", description: "Shown before the Minecraft player data connection is live.", fields: [field("emptyTitle", "Title"), field("emptyMessage", "Description", { type: "textarea" }), field("emptyCta", "Button label")] },
    ],
    defaults: { fallbackEyebrow: "Player directory", onlineSuffix: "online now", heroTitle: "Find any player.", heroLead: "Search the directory, check who's online, and dive into public profiles, stats, and achievements.", emptyTitle: "The full directory isn't live yet", emptyMessage: "Profiles, playtime and balances arrive once the Minecraft data pipeline is connected.", emptyCta: "How to play" },
  },
  leaderboards: {
    id: "leaderboards", label: "Leaderboards", path: "/leaderboards", eyebrow: "Ranking page",
    description: "Edit leaderboard hero copy and the message shown before statistics arrive.",
    permissionKey: MINECRAFT_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The heading above the live standings.", fields: [field("heroEyebrow", "Eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "empty", title: "Empty state", description: "Shown before player statistics are synchronized.", fields: [field("emptyTitle", "Title"), field("emptyMessage", "Description", { type: "textarea" }), field("emptyCta", "Button label")] },
    ],
    defaults: { heroEyebrow: "Hall of fame", heroTitle: "Who's on top?", heroLead: "Live all-time PlayTime and economy rankings, synchronized directly from the Minecraft server.", emptyTitle: "No rankings yet", emptyMessage: "Leaderboards fill in once the Minecraft server starts reporting player statistics. No standings are shown until those numbers are real.", emptyCta: "How to play" },
  },
  status: {
    id: "status", label: "Status", path: "/status", eyebrow: "Live server page",
    description: "Edit the status hero, connection message, metric labels, edition cards, and history panel.",
    permissionKey: PLAY_PERMISSION_KEY,
    panels: [
      { id: "hero", title: "Hero", description: "The opening status page message.", fields: [field("heroEyebrow", "Eyebrow"), field("heroTitle", "Title"), field("heroLead", "Description", { type: "textarea" })] },
      { id: "connection", title: "Connection panel", description: "Status labels and the message shown when telemetry is unavailable.", fields: [field("providerUnavailable", "Provider unavailable message", { type: "textarea", help: "The active Java address is shown separately after this text." }), field("statusUnavailable", "Unavailable label"), field("serverOnline", "Online label"), field("serverOffline", "Offline label"), field("lastUpdated", "Last updated label"), field("copyIpCta", "Copy IP button")] },
      { id: "metrics", title: "Metrics & editions", description: "Labels used on the live statistic and connection cards.", fields: [field("playersLabel", "Players metric"), field("versionLabel", "Version metric"), field("pingLabel", "Ping metric"), field("uptimeLabel", "Uptime metric"), field("javaTitle", "Java card title"), field("bedrockTitle", "Bedrock card title"), field("reachableLabel", "Reachable label"), field("offlineLabel", "Offline label"), field("unknownLabel", "Unknown label"), field("motdTitle", "MOTD title")] },
      { id: "history", title: "History panel", description: "The illustrative uptime history panel at the bottom of the page.", fields: [field("historyTitle", "Title"), field("historyPeriod", "Period label"), field("historyBody", "Description", { type: "textarea" })] },
    ],
    defaults: { heroEyebrow: "Live telemetry", heroTitle: "Server status", heroLead: "A real-time look at the network. When our status API is connected, everything here updates automatically.", providerUnavailable: "The live provider could not reach the configured Java server. Check that the server is running and accepts Server List Ping requests; the website will not show fabricated numbers.", statusUnavailable: "Status unavailable", serverOnline: "Server online", serverOffline: "Server offline", lastUpdated: "Last updated", copyIpCta: "Copy server IP", playersLabel: "Players online", versionLabel: "Version", pingLabel: "Ping", uptimeLabel: "Uptime", javaTitle: "Java Edition", bedrockTitle: "Bedrock Edition", reachableLabel: "Reachable", offlineLabel: "Offline", unknownLabel: "Unknown", motdTitle: "MOTD", historyTitle: "Uptime history", historyPeriod: "last 24h", historyBody: "Illustrative visual. Real history appears once a status API and a history store are connected." },
  },
};

export function pageFieldKeys(definition: PageContentDefinition): string[] {
  return definition.panels.flatMap((panel) => panel.fields.map((item) => item.key));
}
import {
  EVENTS_PERMISSION_KEY,
  GALLERY_PERMISSION_KEY,
  GAMEMODES_PERMISSION_KEY,
  MINECRAFT_PERMISSION_KEY,
  NEWS_PERMISSION_KEY,
  PLAY_PERMISSION_KEY,
  RULES_PERMISSION_KEY,
  STAFF_PERMISSION_KEY,
  VOTING_PERMISSION_KEY,
} from "@/lib/auth/permissions";
