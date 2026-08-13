# Mazora Discord Presence Bot

Standalone Discord presence worker for the Mazora Network.

## Branches

- `Dev`: Mazora website
- `discord-bot-presence`: this Render worker

Render must deploy `discord-bot-presence`. The bot branch intentionally does
not contain the Next.js website, Supabase migrations, Vercel configuration, or
website assets.

## Presence rotation

The bot rotates these live activities:

- `🌐 mazora.us • Live`
- `⛏️ mc.mazora.us • <players>/<capacity>`
- `🟣 Discord • <online> online`

Minecraft data comes from `https://mazora.us/api/status`. Discord counts come
from Discord's invite API.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Secret bot token from Discord Developer Portal → Bot. |
| `NEXT_PUBLIC_SITE_URL` | Website source for live Minecraft status. Use `https://mazora.us`. |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | Permanent Mazora invite used for community counts. |

Optional values:

| Variable | Default |
| --- | --- |
| `DISCORD_PRESENCE_REFRESH_MS` | `60000` (minimum `30000`) |
| `DISCORD_PRESENCE_ROTATE_MS` | `20000` (minimum `15000`) |
| `PORT` | `10000` locally; supplied automatically by Render |

Never commit the bot token or paste it into public logs, screenshots, or
documentation.

## Discord requirements

The application must be installed as a bot in the Mazora Discord server. The
worker requests only the standard `Guilds` gateway intent; privileged Member,
Presence, and Message Content intents are not required.

## Local verification

Copy `.env.example` to the ignored `.env`, add the real values, and run:

```bash
npm ci
npm run typecheck
npm run bot:presence:once
```

The one-shot test connects, fetches a live snapshot, updates the presence, and
disconnects automatically. Start a persistent local worker with:

```bash
npm run bot:presence
```

Its health endpoint is `http://localhost:10000/health` by default.

## Render deployment

The repository includes `render.yaml`. Use these settings if configuring the
service manually:

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Branch | `discord-bot-presence` |
| Runtime | Node |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/health` |
| Instance | Free |

Do not add a `PORT` environment variable in Render; Render supplies it.

After deployment, `/health` should return JSON containing `"ok": true` and
`"discord": "connected"`.

Only one persistent worker should use the token. Do not leave a local worker
running while Render is active because both processes will compete to update
the same bot presence.
