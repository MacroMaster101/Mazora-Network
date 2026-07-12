<div align="center">

# Mazora Network

The official community platform for the Mazora Minecraft network.

**Java server:** `mc.mazora.us`<br>
**Discord:** [discord.gg/ZPrzyGpMyt](https://discord.gg/ZPrzyGpMyt)

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

</div>

## About the project

Mazora Network is a responsive Minecraft community website built with the Next.js App Router. It combines a cinematic Minecraft presentation with practical community features: server connection details, live Minecraft and Discord counts, news, events, forums, player profiles, game modes, support forms, store pages, account areas, and administration scaffolds.

The public site works without a database by using typed demo content. When `DATABASE_URL` is configured, repository functions can read and write Postgres data through Drizzle ORM.

### Current experience

- Responsive homepage with a full-screen Minecraft hero and continuous themed background
- Separate light and dark component themes over one consistent visual world
- Desktop navigation that hides while scrolling down and returns cleanly on intentional upward scrolling
- Mobile navigation drawer with forums, additional pages, theme selection, and account actions
- Live Java server count for `mc.mazora.us`
- Live Discord member and online counts from the Mazora invite
- News board, pagination, network summary, responsive footer, and copy-IP actions
- Keyboard focus states, semantic landmarks, skip navigation, accessible labels, and reduced-motion support

## Technology

| Area | Implementation |
|---|---|
| Framework | Next.js 15 App Router, React 19, Server Components, Server Actions |
| Language | TypeScript with strict checking |
| Styling | Tailwind CSS 3 plus theme tokens in `src/styles/globals.css` |
| UI | Lucide icons and Framer Motion |
| Data | Drizzle ORM with PostgreSQL and typed demo fallbacks |
| Database driver | Neon serverless PostgreSQL driver |
| Validation | Zod |
| Authentication | Demonstration cookie-session abstraction; Supabase packages are prepared for a future secure auth implementation |
| Quality | ESLint, TypeScript, Next.js production builds, npm audit |

## Quick start

Requirements:

- Node.js 20 or newer
- npm 10 or newer

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Environment variables and a database are optional for local UI development.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run typecheck` | Run strict TypeScript checking without emitting files |
| `npm run build` | Create and validate the production build |
| `npm run start` | Serve a completed production build |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:push` | Push the current schema to the configured Postgres database |
| `npm run db:seed` | Seed the configured database using `.env` |

Before handing off a change, run:

```bash
npm run lint
npm run typecheck
npm run build
```

Development output is stored in `.next-dev`, separately from the production `.next` directory. This allows a production build to run without corrupting an active development server's manifests.

## Environment configuration

Copy `.env.example` to `.env` or `.env.local` when overrides are needed. Never commit either file.

| Variable | Required | Description |
|---|---:|---|
| `NEXT_PUBLIC_SITE_URL` | No | Canonical public URL. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | No | Public Discord invite override. The Mazora invite is used by default. |
| `MINECRAFT_STATUS_API_URL` | No | Custom Minecraft status JSON endpoint. The site otherwise queries mcsrvstat.us for `mc.mazora.us`. |
| `DATABASE_URL` | No | Neon or Supabase-compatible PostgreSQL connection string. Demo data is used when absent. |
| `MINECRAFT_PLUGIN_SECRET` | For plugin callbacks | Server-only secret used by the Minecraft link endpoint. |
| `NEXT_PUBLIC_SUPABASE_URL` | Future auth | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Future auth | Browser-safe Supabase anonymous key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Future server use | Server-only Supabase service key. Never expose it publicly. |

The live integrations fail safely:

- Minecraft status is fetched server-side and cached for five minutes. Failed requests return an unavailable state instead of invented player counts.
- Discord counts are fetched from Discord's invite API and cached for five minutes. A failed or invalid invite returns a join prompt instead of a fabricated count.

## Main navigation and routes

The public navigation is:

`Home` · `Play` · `Gallery` · `Forums` · `Our Team` · `Rules` · `Store` · `More`

Forums contains staff applications, ban appeals, suggestions, and the discussion forum. More contains game modes, players, leaderboards, news, events, voting, support, and Discord.

### Public areas

- `/` — homepage, live counts, news, and network summary
- `/play`, `/status`, `/discord`, `/vote`
- `/gallery`, `/game-modes`, `/game-modes/[slug]`
- `/players`, `/players/[username]`, `/leaderboards`
- `/news`, `/news/[slug]`, `/events`, `/events/[slug]`
- `/forums`, `/staff`, `/rules`
- `/store`, `/store/[slug]`, `/cart`
- `/support` and the appeal, report, suggestion, and staff-application forms

### Account areas

- Authentication screens for login, registration, verification, and password recovery
- `/dashboard` plus Minecraft linking, statistics, tickets, appeals, reports, events, votes, purchases, notifications, and settings
- `/admin` plus users, players, content, moderation, orders, voting, configuration, and audit views

The current session implementation is deliberately a demonstration layer. It is suitable for navigating and testing role-aware UI, but it is not a production authentication boundary. Replace it with Supabase Auth or another secure identity provider before accepting real accounts.

## Data and database setup

Pages read through the repositories in `src/lib/data`. Repositories use PostgreSQL when a database is configured and typed fixtures when it is not.

To use a database:

1. Add a valid PostgreSQL connection string to `DATABASE_URL`.
2. Push or generate the schema.
3. Seed the initial content if desired.

```bash
npm run db:push
npm run db:seed
```

The Drizzle schema lives in `src/lib/db/schema.ts`. Generated migrations are written to `supabase/migrations` and remain compatible with PostgreSQL providers such as Neon and Supabase.

## Project structure

```text
src/
  app/                 Route groups, pages, API routes, metadata, and layouts
  components/
    admin/             Administration UI
    dashboard/         Member dashboard UI
    layout/            Header, navigation, footer, and mobile drawer
    shared/            Reusable cards, forms, live status, and content blocks
    theme/             Theme controls and persistence
    ui/                UI primitives
  lib/
    actions/           Validated server actions
    auth/              Swappable session abstraction
    data/              Data repositories and live integrations
    db/                Database client, schema, demo fixtures, and seed logic
    site.ts            Server identity, navigation, social, and footer configuration
  styles/globals.css   Design tokens, themes, layout, and responsive styling
public/images/         Logo, Minecraft artwork, avatars, and content imagery
supabase/migrations/   PostgreSQL migrations
docs/                  Maintainer documentation
```

For architecture, live integrations, theme behavior, and deployment notes, see [docs/README.md](docs/README.md).

## Production notes

- Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin.
- Configure a production Postgres database before enabling persistent forms or account data.
- Replace the demonstration session implementation before launching real authentication.
- Set a strong `MINECRAFT_PLUGIN_SECRET` before enabling Minecraft account linking callbacks.
- Replace placeholder social destinations in `src/lib/site.ts` with official Mazora accounts.
- Store all server-only secrets in the deployment platform, never in public environment variables or source control.
- Payments are not implemented; store and cart pages are presentation and architecture only.

## Status

The public platform and responsive homepage are implemented. Database-backed content is optional. Secure production authentication, payment processing, complete admin mutations, and production Minecraft synchronization remain deployment-phase work.

---

Mazora Network is an independent Minecraft community and is not affiliated with Mojang Studios or Microsoft.
