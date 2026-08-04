export interface PlayPageConfig {
  javaIp: string;
  bedrockIp: string;
  bedrockPort: string;
  supportedVersion: string;
  discordChannelId: string;
  heroTitle: string;
  heroLead: string;
  statusOverride: "live" | "degraded" | "offline";
  telemetryMessage?: string;
  javaSteps: string[];
  bedrockSteps: string[];
}

export const DEFAULT_PLAY_CONFIG: PlayPageConfig = {
  javaIp: "mc.mazora.us",
  bedrockIp: "mc.mazora.us",
  bedrockPort: "8876",
  supportedVersion: "Leaf 1.21.11",
  discordChannelId: "1193207365906997379",
  heroTitle: "Joining takes about a minute.",
  heroLead: "Copy the address, add the server, and you're in. Here's exactly how on both editions.",
  statusOverride: "live",
  telemetryMessage: "No downtime recorded during this hour.",
  javaSteps: [
    "Open Minecraft Java Edition.",
    "Click Multiplayer, then Add Server.",
    "Enter Server Name: Mazora Network and Server Address: mc.mazora.us",
    "Click Done, select Mazora Network, and click Join Server.",
  ],
  bedrockSteps: [
    "Open Minecraft on your mobile device, Windows PC, or console.",
    "Tap Play, then choose the Servers tab.",
    "Scroll down and tap Add Server.",
    "Server Name: Mazora Network, Server Address: mc.mazora.us",
    "Enter the port: 8876",
    "Save, then tap the server to join.",
  ],
};

let currentPlayConfig: PlayPageConfig = { ...DEFAULT_PLAY_CONFIG };

export async function getPlayPageConfig(): Promise<PlayPageConfig> {
  return currentPlayConfig;
}

export async function updatePlayPageConfig(newConfig: Partial<PlayPageConfig>): Promise<PlayPageConfig> {
  currentPlayConfig = {
    ...currentPlayConfig,
    ...newConfig,
  };
  return currentPlayConfig;
}
