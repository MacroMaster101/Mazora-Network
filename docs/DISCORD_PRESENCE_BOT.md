# Mazora Discord Presence Bot

This branch contains the standalone Discord presence worker. It keeps the
Mazora Network bot online and rotates these live activities:

- `mazora.us • Live`
- `mc.mazora.us • <players>/<capacity>`
- `Discord • <online> online`

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Discord bot token from the Developer Portal. Keep it secret. |
| `NEXT_PUBLIC_SITE_URL` | Website origin used for `/api/status`; use `https://mazora.us`. |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | Permanent Mazora Discord invite used to obtain community counts. |

Optional timing variables:

| Variable | Default |
| --- | --- |
| `DISCORD_PRESENCE_REFRESH_MS` | `60000` |
| `DISCORD_PRESENCE_ROTATE_MS` | `20000` |

## Local test

Put the variables in `.env`, then run:

```bash
npm install
npm run bot:presence -- --once
```

For a persistent local worker, run:

```bash
npm run bot:presence
```

The health endpoint is available at `http://localhost:10000/health` unless a
different `PORT` is supplied.

## Render deployment

1. Push this branch to GitHub.
2. In Render, select **New → Blueprint**.
3. Connect the Mazora Network repository and select this branch.
4. Render detects `render.yaml` and creates `mazora-discord-presence`.
5. Enter `DISCORD_BOT_TOKEN` and `NEXT_PUBLIC_DISCORD_INVITE_URL` when prompted.
6. Deploy and wait for the logs to show `connected as Mazora Network#9678`.
7. Open `https://<service-name>.onrender.com/health` and confirm it returns JSON.

## Preventing free-tier sleep

Create a free UptimeRobot HTTP monitor with:

- URL: `https://<service-name>.onrender.com/health`
- Interval: 5 minutes
- Method: `GET`

Render free services may still restart and do not guarantee production uptime.
The bot reconnects automatically when the Discord Gateway connection returns.

Do not run this branch locally and on Render at the same time. Two workers using
the same token will compete to update the bot activity.
