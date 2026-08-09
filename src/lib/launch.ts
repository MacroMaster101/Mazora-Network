export type LaunchGate = {
  path: string;
  match?: "exact" | "tree" | "children";
  icon: string;
  eyebrow: string;
  title: string;
  message: string;
};

export const launchGates: LaunchGate[] = [
  {
    path: "/forums",
    icon: "MessagesSquare",
    eyebrow: "Community launch",
    title: "The forums are opening soon.",
    message: "We are preparing accounts, moderation and real discussion data before opening community posting.",
  },
  {
    path: "/players",
    match: "tree",
    icon: "Users",
    eyebrow: "Network data",
    title: "Player profiles are syncing soon.",
    message: "Live profiles and statistics will open after the Minecraft account pipeline has completed verification.",
  },
  {
    path: "/leaderboards",
    icon: "Trophy",
    eyebrow: "Network data",
    title: "Leaderboards are being calibrated.",
    message: "Rankings will open when live server statistics replace preview data.",
  },
  {
    path: "/support/report-player",
    icon: "Shield",
    eyebrow: "Support launch",
    title: "Player reports will open soon.",
    message: "Private evidence storage and moderator workflows are being verified before reports are accepted.",
  },
  {
    path: "/support/report-bug",
    icon: "Bug",
    eyebrow: "Support launch",
    title: "Bug reporting will open soon.",
    message: "The tracked support workflow is in final testing. For urgent help, contact the team on Discord.",
  },
  {
    path: "/support/suggestions",
    icon: "Sparkles",
    eyebrow: "Community launch",
    title: "Suggestions will open soon.",
    message: "Voting, moderation and account attribution are being completed before ideas are accepted.",
  },

  {
    path: "/dashboard",
    match: "children",
    icon: "Activity",
    eyebrow: "Account launch",
    title: "This account feature is coming soon.",
    message: "Your account is safe. This section is still being connected to live Minecraft and support data.",
  },
];

export function isLaunchModeEnabled(): boolean {
  return process.env.MAZORA_LAUNCH_MODE !== "off";
}

/** Paths that are ready even when the dashboard children gate is active. */
const dashboardExclusions = new Set([
  "/dashboard/settings",
  "/dashboard/minecraft",
  "/dashboard/statistics",
  // Store orders are recorded and their status is kept current from Discord,
  // so purchase history shows real data rather than a placeholder.
  "/dashboard/purchases",
]);

export function getLaunchGate(pathname: string): LaunchGate | undefined {
  if (dashboardExclusions.has(pathname)) return undefined;
  return launchGates.find((gate) => {
    if (gate.match === "tree") return pathname === gate.path || pathname.startsWith(gate.path + "/");
    if (gate.match === "children") return pathname.startsWith(gate.path + "/");
    return pathname === gate.path;
  });
}

export function isRouteLaunchGated(pathname: string): boolean {
  return isLaunchModeEnabled() && Boolean(getLaunchGate(pathname));
}
