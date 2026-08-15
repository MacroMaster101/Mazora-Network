<div align="center">

<img src="https://raw.githubusercontent.com/MacroMaster101/Mazora-Network/Dev/public/images/mazora-logo.webp" alt="Mazora Network Logo" width="220" />

# Mazora Discord Presence Bot

**The standalone live-status worker for the Mazora Network Discord bot.**

[mazora.us](https://mazora.us) • `mc.mazora.us` • [Health status](https://mazora-network.onrender.com/health)

[![Node.js](https://img.shields.io/badge/Node.js-24-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Render](https://img.shields.io/badge/Hosted_on-Render-46E3B7?logo=render&logoColor=black)](https://render.com)

</div>

## 🤖 About the bot

This branch contains a lightweight Discord presence service for Mazora Network. It connects to Discord, retrieves live Minecraft and community totals, and rotates those values through the bot's activity status.

The service also exposes a small HTTP health endpoint so Render and external uptime monitoring can verify that the Discord connection and data refresh loop are healthy.

## 🌿 Repository branches

| Branch | Purpose | Deployment |
|---|---|---|
| `Dev` | Complete Mazora website | Vercel |
| `discord-bot-presence` | Standalone Discord presence bot | Render |

Render must deploy `discord-bot-presence`. This branch intentionally excludes the Next.js website, Supabase migrations, Vercel configuration, and website assets.

## ✨ Presence rotation

The bot rotates these live activities:

- `🌐 mazora.us • Live` or `Offline`, based on a real website probe
- `⛏️ mc.mazora.us • <players>/<server capacity>`, or `Offline` when the server cannot be reached
- `🟣 Discord • <online> online`

Minecraft data and capacity are read from `https://mazora.us/api/status`, with a public Minecraft status API as a fallback. Failed probes clear the previous values so an outage is never shown with a stale player count or capacity. Discord totals are read from Discord's invite API.

## 🧱 Technology

| Area | Implementation |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript with strict checking |
| Discord client | discord.js 14 using the standard `Guilds` intent |
| Script runner | tsx |
| Hosting | Render Web Service |
| Monitoring | HTTP JSON endpoint at `/health` |
| Live data | Mazora status API, Minecraft fallback API, and Discord invite API |

## 🔐 Environment variables

Create an ignored `.env` file locally or configure these values in Render:

| Variable | Required | Purpose |
|---|---:|---|
| `DISCORD_BOT_TOKEN` | Yes | Secret token from Discord Developer Portal → Bot |
| `NEXT_PUBLIC_SITE_URL` | Yes | Website source for live status; use `https://mazora.us` |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | Yes | Permanent Mazora invite used for community totals |
| `DISCORD_PRESENCE_REFRESH_MS` | No | Data refresh interval; default `60000`, minimum `30000` |
| `DISCORD_PRESENCE_ROTATE_MS` | No | Activity rotation interval; default `20000`, minimum `15000` |
| `PORT` | No | Local default is `10000`; Render supplies this automatically |

Never commit the bot token or expose it in logs, screenshots, documentation, or client-side code.

## 🚀 Local development

Requirements:

- Node.js 24
- npm 10 or newer
- A Discord application installed as a bot in the Mazora server

Copy `.env.example` to `.env`, enter the required values, then run:

```bash
npm ci
npm run typecheck
npm run bot:presence:once
```

The one-shot command connects, fetches one live snapshot, updates the presence, and disconnects. To run the persistent worker locally:

```bash
npm run bot:presence
```

Do not run a local persistent worker while Render is active. Two processes using the same token will compete to update the bot presence.

## 🛠️ Commands

| Command | Purpose |
|---|---|
| `npm start` | Start the production worker on Render |
| `npm run bot:presence` | Start locally using variables from `.env` |
| `npm run bot:presence:once` | Connect, update once, and disconnect |
| `npm run typecheck` | Run strict TypeScript checking without emitting files |

## ☁️ Render deployment

The checked-in `render.yaml` defines the service. For manual configuration, use:

| Setting | Value |
|---|---|
| Service type | Web Service |
| Branch | `discord-bot-presence` |
| Runtime | Node |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/health` |
| Auto-deploy | On commit |

Do not manually define `PORT`; Render supplies it. After deployment, the public health endpoint should return HTTP 200 JSON containing `"ok": true` and `"discord": "connected"`.

## 💓 Monitoring and free-tier behavior

The live service is monitored at:

```text
https://mazora-network.onrender.com/health
```

UptimeRobot currently requests this endpoint every five minutes. This supplies regular inbound traffic and reports outages. Render Free can still restart services, enforce monthly limits, or change free-tier behavior, so this setup is suitable for a hobby project rather than guaranteed production uptime.

If the monitor reports a failure, check Render deployment logs first, verify the three required environment variables, and confirm that the bot remains installed in the Discord server.

## 🔒 Discord permissions

The worker requests only the standard `Guilds` gateway intent. Privileged Member, Presence, and Message Content intents are not required. The bot does not read messages, manage members, or request administrator permissions.
