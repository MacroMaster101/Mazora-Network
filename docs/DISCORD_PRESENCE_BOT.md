# Mazora Discord Presence Bot

## Branch ownership

- Website development and deployment: `Dev`
- Standalone Discord presence worker: `discord-bot-presence`
- Render must deploy `discord-bot-presence`, not `Dev` or `main`.

Keep the bot-only files (`render.yaml`, `scripts/discord-presence.ts`, and the
`bot:presence` package scripts) on `discord-bot-presence`. Website fixes belong
on `Dev` and can be merged into this branch when the worker needs the latest
shared website code.

This branch keeps the Mazora Network bot online and rotates these live
activities:

- `mazora.us • Live`
- `mc.mazora.us • <players>/<capacity>`
- `Discord • <online> online`

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Discord bot token from the Developer Portal. Keep it secret. |
| `NEXT_PUBLIC_SITE_URL` | Website origin used for `/api/status`; use `https://mazora.us`. |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | Permanent Mazora Discord invite used to obtain community counts. |

Render supplies `PORT` automatically. Do not create a public token variable and
never commit the value of `DISCORD_BOT_TOKEN` to Git, `.env.example`, screenshots,
logs, or documentation.

## Discord application requirements

- Add the Mazora Network application as a bot in the Mazora Discord server.
- The worker only requests the standard `Guilds` gateway intent; no privileged
  Member, Presence, or Message Content intent is required.
- Use the token from **Discord Developer Portal → Bot → Reset Token**.
- The bot must have permission to connect to the server. It does not need channel
  moderation permissions just to display this presence.

Optional timing variables:

| Variable | Default |
| --- | --- |
| `DISCORD_PRESENCE_REFRESH_MS` | `60000` |
| `DISCORD_PRESENCE_ROTATE_MS` | `20000` |

## Local test

Check out this branch and put the variables in the ignored `.env` file, then run:

```bash
git switch discord-bot-presence
npm install
npm run bot:presence -- --once
```

The one-shot command connects, fetches one live snapshot, updates the activity,
and exits. It is the safest validation before enabling the persistent worker.

For a persistent local worker, run:

```bash
npm run bot:presence
```

The health endpoint is available at `http://localhost:10000/health` unless a
different `PORT` is supplied.

## Render deployment

1. Push `discord-bot-presence` to GitHub.
2. In Render, select **New → Blueprint**.
3. Connect the Mazora Network repository and select the
   **`discord-bot-presence`** branch.
4. Render detects `render.yaml` and creates `mazora-discord-presence`.
5. Enter `DISCORD_BOT_TOKEN` and `NEXT_PUBLIC_DISCORD_INVITE_URL` in Render's
   secret environment-variable fields. Keep `NEXT_PUBLIC_SITE_URL` set to
   `https://mazora.us`.
6. Deploy and wait for the logs to show `connected as Mazora Network#9678`.
7. Open `https://<service-name>.onrender.com/health` and confirm it returns JSON
   with `"ok": true`, `"discord": "connected"`, and live snapshot timestamps.

Render's service settings should continue using:

| Setting | Value |
| --- | --- |
| Branch | `discord-bot-presence` |
| Build command | `npm ci` |
| Start command | `npm run bot:presence:render` |
| Health check path | `/health` |
| Runtime | Node.js 24 |

## Preventing free-tier sleep

Create a free UptimeRobot HTTP monitor with:

- URL: `https://<service-name>.onrender.com/health`
- Interval: 5 minutes
- Method: `GET`

Render free services may still restart and do not guarantee production uptime.
The bot reconnects automatically when the Discord Gateway connection returns.

Do not run this branch locally and on Render at the same time. Two workers using
the same token will compete to update the bot activity.

## Updating the worker later

Make bot changes only while the repository is checked out on
`discord-bot-presence`. Before a Render deployment, run:

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --run
```

Push only after those checks pass. Render automatically deploys new commits from
`discord-bot-presence`; commits pushed only to `Dev` do not restart the bot.
