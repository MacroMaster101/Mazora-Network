/**
 * Register the guild slash commands. Guild-scoped rather than global so the
 * command appears immediately and only in the Mazora server.
 *
 * Run with: npm run discord:commands
 *
 * Wrapped in main() rather than using top-level await: this project has no
 * `"type": "module"`, so tsx transforms scripts as CJS and top-level await is a
 * transform error. Same shape as scripts/set-role.ts and scripts/apply-sql.ts.
 */

const COMMANDS = [
  {
    name: "staff-notice",
    description: "Send a server member a direct message from the Mazora bot",
    options: [
      { name: "user", description: "Who to message", type: 6, required: true },
      {
        name: "template",
        description: "Which notice to send",
        type: 3,
        required: true,
        // "Terminated" is deliberately absent: the slash command refuses that
        // template outright (src/lib/discord/staff-notice-command.ts), since
        // termination is owner-gated on the web and Discord has no equivalent
        // rank check. Omitting the choice keeps it out of Discord's UI too.
        choices: [
          { name: "Warning", value: "warning" },
          { name: "Promotion (staff only)", value: "promotion" },
          { name: "Custom", value: "custom" },
        ],
      },
      {
        name: "reason",
        description: "The reason, included in the message",
        type: 3,
        required: true,
        // Serves the same suggested reasons the admin page shows as chips,
        // handled by handleStaffNoticeAutocomplete in the interactions route.
        autocomplete: true,
      },
      { name: "title", description: "Title, for the custom template only", type: 3, required: false },
    ],
  },
];

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  const missing = [
    !token && "DISCORD_BOT_TOKEN",
    !applicationId && "DISCORD_APPLICATION_ID",
    !guildId && "DISCORD_GUILD_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    console.error("Set them in .env, then run: npm run discord:commands");
    process.exit(1);
  }

  // Both ids are Discord snowflakes. Checking the shape here turns a confusing
  // 404 from Discord into a clear message about which value is wrong.
  for (const [name, value] of [
    ["DISCORD_APPLICATION_ID", applicationId],
    ["DISCORD_GUILD_ID", guildId],
  ] as const) {
    if (!/^\d{17,20}$/.test(value as string)) {
      console.error(`${name} is not a valid Discord id (expected 17-20 digits).`);
      process.exit(1);
    }
  }

  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(COMMANDS),
      },
    );
  } catch (error) {
    console.error("Could not reach Discord:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`Command registration failed (HTTP ${response.status})`);
    // 401 means the token is wrong; 403 usually means the application id
    // belongs to a different application than the token.
    if (response.status === 401) console.error("Check DISCORD_BOT_TOKEN.");
    if (response.status === 403 || response.status === 404) {
      console.error("Check that DISCORD_APPLICATION_ID matches the bot, and that the bot is in the guild.");
    }
    console.error(body);
    process.exit(1);
  }

  console.log(`Registered in guild ${guildId}: ${COMMANDS.map((c) => `/${c.name}`).join(", ")}`);
  console.log("It may take a moment to appear in Discord's command list.");
}

main();
