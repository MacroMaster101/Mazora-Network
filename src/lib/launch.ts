export type LaunchGate = {
  path: string;
  match?: "exact" | "tree" | "children";
  eyebrow: string;
  title: string;
  message: string;
};

export const launchGates: LaunchGate[] = [
  {
    path: "/store",
    match: "tree",
    eyebrow: "Store launch",
    title: "The Mazora Store is opening soon.",
    message: "Payments and automatic in-game delivery are in final testing. No products are being sold or charges processed yet.",
  },
  {
    path: "/cart",
    eyebrow: "Store launch",
    title: "Checkout is not open yet.",
    message: "The secure checkout and delivery flow will appear here when the store is ready.",
  },
  {
    path: "/forums",
    eyebrow: "Community launch",
    title: "The forums are opening soon.",
    message: "We are preparing accounts, moderation and real discussion data before opening community posting.",
  },
  {
    path: "/players",
    match: "tree",
    eyebrow: "Network data",
    title: "Player profiles are syncing soon.",
    message: "Live profiles and statistics will open after the Minecraft account pipeline has completed verification.",
  },
  {
    path: "/leaderboards",
    eyebrow: "Network data",
    title: "Leaderboards are being calibrated.",
    message: "Rankings will open when live server statistics replace preview data.",
  },
  {
    path: "/vote",
    eyebrow: "Rewards launch",
    title: "Voting rewards are coming soon.",
    message: "Vote callbacks, streaks and automatic rewards are being connected before this page opens.",
  },
  {
    path: "/support/appeal",
    eyebrow: "Support launch",
    title: "Appeals will open soon.",
    message: "We are finishing private case storage and staff review notifications before accepting submissions.",
  },
  {
    path: "/support/report-player",
    eyebrow: "Support launch",
    title: "Player reports will open soon.",
    message: "Private evidence storage and moderator workflows are being verified before reports are accepted.",
  },
  {
    path: "/support/report-bug",
    eyebrow: "Support launch",
    title: "Bug reporting will open soon.",
    message: "The tracked support workflow is in final testing. For urgent help, contact the team on Discord.",
  },
  {
    path: "/support/suggestions",
    eyebrow: "Community launch",
    title: "Suggestions will open soon.",
    message: "Voting, moderation and account attribution are being completed before ideas are accepted.",
  },
  {
    path: "/support/content-creator",
    eyebrow: "Creator program",
    title: "The Content Creator program is coming soon.",
    message: "Applications, creator benefits and publishing guidelines are being finalized before the program opens.",
  },
  {
    path: "/support/staff-application",
    eyebrow: "Team launch",
    title: "Staff applications are currently closed.",
    message: "Application intake will reopen when the next recruitment round begins.",
  },
  {
    path: "/dashboard",
    match: "children",
    eyebrow: "Account launch",
    title: "This account feature is coming soon.",
    message: "Your account is safe. This section is still being connected to live Minecraft and support data.",
  },
];

export function isLaunchModeEnabled(): boolean {
  return process.env.MAZORA_LAUNCH_MODE !== "off";
}

export function getLaunchGate(pathname: string): LaunchGate | undefined {
  return launchGates.find((gate) => {
    if (gate.match === "tree") return pathname === gate.path || pathname.startsWith(gate.path + "/");
    if (gate.match === "children") return pathname.startsWith(gate.path + "/");
    return pathname === gate.path;
  });
}

export function isRouteLaunchGated(pathname: string): boolean {
  return isLaunchModeEnabled() && Boolean(getLaunchGate(pathname));
}
