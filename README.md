
<div align="center">

<img src="public/images/mazora-logo.webp" alt="Mazora Network Logo" width="220" />

# Mazora Network

**The official community platform for the Mazora Minecraft network.**

`mc.mazora.us` • [mazora.us](https://mazora.us)

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com)

</div>

## ⛏️ About the project

Mazora Network is a production-ready Minecraft community website built with the Next.js App Router. It combines a cinematic Minecraft presentation with practical community features: server connection details, live Minecraft and Discord counts, news, events, forums, player profiles, game modes, support forms, a full storefront, member dashboards, and a role-based staff administration panel.

The site reads its content from PostgreSQL through Drizzle ORM. Without `DATABASE_URL`,
repositories return nothing and each page shows an explicit empty state rather than
placeholder content — the store, rulebook, gallery, news, and live counts are the parts
backed by real data today.

### ✨ Current experience

- Responsive homepage with a full-screen Minecraft hero and continuous themed background
- Full light and dark theme support across all pages — first visit follows device preference, then user choice is persisted locally
- Desktop navigation that hides while scrolling down and returns cleanly on intentional upward scrolling
- Mobile navigation drawer with forums, additional pages, theme selection, and account actions
- Live Java server count for `mc.mazora.us`
- Live Discord member and online counts from the Mazora invite
- News board, pagination, network summary, responsive footer, and copy-IP actions
- Minecraft skin avatars throughout the UI — header, dashboard sidebar, profile editor, player cards, and admin user directory
- Discord-based store ordering with ticket lifecycle, purchase announcements, and transcript archival
- Role-based admin control room with live telemetry, user management, permissions editor, player management, and content tools
- Member dashboard with profile editing, avatar upload, connected accounts (Discord), ticket system, and notification preferences
- Keyboard focus states, semantic landmarks, skip navigation, accessible labels, and reduced-motion support

## 🧱 Technology

| Area | Implementation |
|---|---|
| Framework | Next.js 15 App Router, React 19, Server Components, Server Actions |
| Language | TypeScript with strict checking |
| Styling | Tailwind CSS 3, theme tokens in `src/styles/globals.css`, route-scoped sheets for the rest |
| UI | Lucide icons; animation is CSS transitions, with no JS animation runtime |
| Data | Drizzle ORM with PostgreSQL; empty states when unconfigured |
| Database driver | postgres-js driver against Supabase PostgreSQL |
| Validation | Zod |
| Authentication | Supabase SSR cookies, PKCE callbacks, email/password, Google, and Discord OAuth; local demo fallback |
| Quality | ESLint, TypeScript, Next.js production builds, npm audit |

## 🚀 Quick start

Requirements:

- Node.js 22 or newer
- npm 10 or newer

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Environment variables and a database are optional for local UI development. The checked-in lockfile makes `npm ci` the preferred reproducible install.

## 🛠️ Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run typecheck` | Run strict TypeScript checking without emitting files |
| `npm test` | Run the unit tests (kept local — see repository hygiene) |
| `npm run build` | Create and validate the production build |
| `npm run start` | Serve a completed production build |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:push` | Push the current schema to the configured Postgres database |
| `npm run db:apply -- <file.sql>` | Apply a single SQL file using `DATABASE_URL` |
| `npm run db:seed:store` | Load the storefront catalogue into `products` |
| `npm run db:seed:rules` | Load the baseline community rulebook |
| `npm run db:rehost:news-images` | Re-host expiring Discord CDN artwork into Supabase storage |
| `npm run role:set -- <email> <role>` | Grant the first owner/IT account |

A few one-off scripts have no npm alias and are run directly. They read `.env` through `tsx`, not `dotenv`:

```bash
npx tsx --env-file=.env scripts/seed-gallery.ts --confirm-replace
npx tsx --env-file=.env scripts/seed-news-preview.ts
```

The gallery seeder replaces all existing gallery images and likes, so it requires the explicit confirmation flag shown above. To clear those tables without reseeding, run `npx tsx --env-file=.env scripts/clear-gallery.ts --confirm`.

Before handing off a change, run:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Development output is stored in `.next-dev`, separately from the production `.next` directory. This allows a production build to run without corrupting an active development server's manifests.

If files under `public/` are bulk-renamed, converted or deleted while `next dev` is running, the image optimiser's in-memory cache keeps pointing at files that no longer exist and every `/_next/image` request starts failing with `LRUCache: calculateSize returned 0`. Images then silently stop rendering until the cache is cleared:

```bash
rm -rf .next-dev
```

This affects development only — each production deploy builds a fresh cache.

## 🔐 Environment configuration

Copy `.env.example` to `.env` or `.env.local` when overrides are needed. Never commit either file.

| Variable | Required | Description |
|---|---:|---|
| `NEXT_PUBLIC_SITE_URL` | No | Canonical public URL. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | No | Public Discord invite override. The Mazora invite is used by default. |
| `MINECRAFT_STATUS_API_URL` | No | Custom Minecraft status JSON endpoint. The site otherwise queries mcsrvstat.us for `mc.mazora.us`. |
| `DATABASE_URL` | No | Supabase PostgreSQL connection string (use the connection pooler URL). Database-backed pages show empty states when absent. |
| `NEXT_PUBLIC_SUPABASE_URL` | Production auth | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production auth | Browser-safe Supabase publishable key for new projects. |
| `DISCORD_STORE_WEBHOOK_URL` | Manual store orders | Private webhook URL for the staff order channel. Never expose it as a public variable. |
| `DISCORD_STORE_STAFF_ROLE_ID` | Store orders | Role(s) permitted to action orders and read every ticket. Accepts one ID or several comma-separated (`<staff>,<management>,<owner>`); only the first is @mentioned on a new order. Order actions are refused entirely while this is unset. |
| `DISCORD_BOT_TOKEN` | Order buttons, news sync | Bot token. Enables Confirm/Reject buttons, order tickets, buyer DMs, and the announcement importer. |
| `DISCORD_APP_PUBLIC_KEY` | Order buttons | Developer Portal → General Information → Public Key. Verifies that button clicks genuinely came from Discord. |
| `DISCORD_ORDERS_CHANNEL_ID` | Order buttons | Staff channel the bot posts order requests into. |
| `DISCORD_GUILD_ID` | Order tickets | Your Discord server ID. Used to verify a buyer has joined before checkout and to create their ticket. Also links imported news back to the original message. |
| `DISCORD_STORE_TICKETS_CATEGORY_ID` | Order tickets | Private category the bot creates one ticket channel per confirmed order in. When unset, confirming an order only DMs the buyer. |
| `DISCORD_TICKET_LOGS_CHANNEL_ID` | Closed tickets | Required archive channel. Closing saves a summary embed and `.txt` transcript here before deleting the live ticket; if archival fails, the live ticket is kept. |
| `DISCORD_BUYERS_CHANNEL_ID` | Purchase announcements | Public channel posted to by the Announce purchase button. Leave empty to skip announcements. The banner artwork ships with the repo and is served from `NEXT_PUBLIC_SITE_URL`, so nothing else needs configuring. |
| `DISCORD_ANNOUNCEMENTS_CHANNEL_ID` | News sync | Channel the announcement importer reads from. |
| `DISCORD_PATCH_CHANNEL_ID` | No | Optional live patch-notes channel; falls back to the announcements channel. |
| `CRON_SECRET` | News sync | Shared secret for the scheduled announcement sync (minimum 16 characters). |
| `NEXT_PUBLIC_BEDROCK_PORT` | No | Bedrock port shown on the Play and Status pages. Defaults to `8876`. |
| `MAZORA_LAUNCH_MODE` | No | Keep `on` while unfinished routes should show the launch-status page. Set to `off` to restore every implementation. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy auth | Legacy browser-safe anonymous key; used only when no publishable key is set. |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin features | Server-only Supabase service key used for user, invitation, staff, and avatar administration. Never expose it publicly. |
| `AUTH_DEMO_MODE` | Local only | Set to `true` only for local UI previews without Supabase. Never enable in production. |

The live integrations fail safely:

- Minecraft status is fetched server-side and cached for five minutes. Failed requests return an unavailable state instead of invented player counts.
- Discord counts are fetched from Discord's invite API and cached for five minutes. A failed or invalid invite returns a join prompt instead of a fabricated count.

## 🛒 Store orders and Discord tickets

No payment is ever taken on the website. Orders are requests that staff fulfil manually.

1. **Checkout.** The buyer connects Discord and is checked for Mazora server membership. Signing in with Discord does not put anyone in the server, and a non-member can be neither DM'd nor added to a ticket, so the join is required before the request can be sent. The check is enforced in the server action, not only in the form.
2. **Staff review.** The order is posted to `DISCORD_ORDERS_CHANNEL_ID` with Confirm and Reject buttons. Only holders of a role listed in `DISCORD_STORE_STAFF_ROLE_ID` may action them — a valid Discord signature proves the request came from Discord, not that the clicker is staff, so the roles are verified separately and the action is refused outright when none are configured. List several roles comma-separated when owners and management sit on different roles from general staff, otherwise they can see every button and use none of them.
3. **Confirm.** The bot creates a private channel under `DISCORD_STORE_TICKETS_CATEGORY_ID`, visible only to the buyer, the staff role and the bot. It posts the order summary there and DMs the buyer a link. Payment is arranged in that channel.
4. **Reject.** The buyer is DM'd; no ticket is created.
5. **Close.** Staff press Close ticket. The bot saves the conversation transcript to `DISCORD_TICKET_LOGS_CHANNEL_ID`, deletes the temporary ticket channel only after that archive succeeds, and marks the order completed. A failed archive or delete keeps the channel and restores the Close button for a safe retry.
6. **Announce.** A separate button posts the purchase to `DISCORD_BUYERS_CHANNEL_ID`, then disables itself so the same sale cannot be posted twice.

Closing and announcing are deliberately separate. A ticket can end without a sale — the buyer changed their mind, never paid, or it was a mistake — and announcing "X bought Y" for someone who never bought is worse than not announcing at all.

**All staff controls live on the order message in `DISCORD_ORDERS_CHANNEL_ID`, never in the ticket.** Discord shows a message's components to everyone who can read it, and the buyer can read their own ticket, so a Close button placed there would be visible to them. Every click is re-checked against the staff role regardless: a valid signature proves the click came from Discord, not that the clicker is staff.

The click is acknowledged immediately and the Discord API work runs afterwards, because Discord discards any interaction not answered within three seconds. The buttons are removed up front, which also stops two staff members creating duplicate tickets.

Degraded states are surfaced rather than hidden. If the buyer left the server since ordering, the message becomes **Awaiting Discord join** instead of opening a ticket. If DMs are closed the ticket still works — the buyer is mentioned in it — and the staff message says the DM failed. Missing configuration is named explicitly on the message.

**Bot permissions.** The bot role needs View Channels, Manage Channels, Send Messages and Read Message History on the tickets category. In the closed-tickets archive channel it also needs View Channel, Send Messages, Embed Links and Attach Files. Without Manage Channels the confirm succeeds but no channel is created; without archive permissions the close is refused and the live ticket is retained.

**Interactions endpoint.** Set Developer Portal → General Information → Interactions Endpoint URL to `https://<your-domain>/api/discord/interactions`. Discord sends a verification ping when you save it, so the site must already be deployed and reachable — button clicks never reach a localhost dev server. To test locally, expose the dev server with a tunnel and point the endpoint at it temporarily.

## 🧭 Main navigation and routes

The public navigation is:

`Home` · `Play` · `Gallery` · `Forums` · `Our Team` · `Rules` · `Store` · `More`

Forums contains staff applications, ban appeals, suggestions, and the discussion forum. More contains game modes, players, leaderboards, news, events, voting, support, and Discord.

### 🌍 Public areas

- `/` — homepage, live counts, news, and network summary
- `/play`, `/status`, `/discord`, `/vote`
- `/gallery`, `/game-modes`, `/game-modes/[slug]`
- `/players`, `/players/[username]`, `/leaderboards`
- `/news`, `/news/[slug]`, `/events`, `/events/[slug]`
- `/forums`, `/staff`, `/rules`
- `/store`, `/store/[slug]`, `/cart`
- `/support` and the appeal, report, suggestion, and staff-application forms

### 👤 Account areas

- Login, registration, and account recovery open in one accessible dialog over the current public page. Every internal auth link is intercepted globally, while direct auth URLs return to the homepage and automatically open the same dialog for refreshes, shared links, protected-route redirects, and OAuth errors.
- `/dashboard` — the member area: overview with stats, profile avatar editor, connected accounts (Discord), tickets, appeals, reports, events, votes, purchases, notifications, and settings. Features a glass-panel sidebar with Minecraft skin avatar and rank badge.
- `/admin` — the staff control room with role-based access. Includes live telemetry dashboard, user directory with role management, permissions editor, player management, content tools (news, rules, gallery, store, game modes, events, pages), moderation (reports, tickets, suggestions), orders with Discord ticket lifecycle, voting configuration, site settings, and audit logs. Each staff role sees only the sections relevant to their rank.

Members and staff land in different places. After signing in, a non-staff member goes to
the homepage and a staff member goes to `/admin`. Staff do not use `/dashboard` — their
account screens (settings, connected accounts, notifications, purchases) live under
`/admin/account`. The header dropdown reflects this: staff see Control Room and My Settings,
members see Dashboard, Tickets, and Settings.

### Roles

The ladder, lowest to highest:

| Role | Staff | Notes |
|---|---|---|
| `guest` | no | Signed out |
| `member` | no | Default for a new account |
| `sponsor` | no | Donor rank |
| `vip` | no | Donor rank |
| `helper` | yes | Entry staff rank; support queues |
| `moderator` | yes | Player moderation |
| `senior_moderator` | yes | Moderation oversight |
| `administrator` | yes | Content and commerce (`is_admin`) |
| `owner` | yes | Users, staff and role management |
| `it` | yes | Highest rank; settings and audit |

`ROLES`, `hasAtLeast`, `isStaff`, `isAdmin` and `roleLabel` in `src/lib/auth/roles.ts` are
the single source of truth — validate against `ROLES` rather than re-listing roles.

The session role is read from Supabase `app_metadata.role` (server-controlled), never from
client-writable `user_metadata`. `profiles.role` mirrors it for RLS. Change roles only
through `changeUserRole`, which enforces rank rules and writes an audit entry. Bootstrap
the first privileged account with `npm run role:set -- <email> it`, then sign out and in.

The control room at `/admin` is one adaptive screen: boards appear according to the
viewer's rank. It marks where each figure comes from — live values are bracketed, and
anything without a data source behind it is shown as "Standby" rather than as a zero.

Authentication uses Supabase SSR cookies and the PKCE authorization-code flow when Supabase is configured. Google and Discord buttons initiate real provider login, `/auth/callback` exchanges the returned code, and middleware refreshes authenticated sessions. Without Supabase, development uses the local demo session only outside production.

To enable production social login:

1. Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Add `http://localhost:3000/auth/callback` and the production equivalent to the Supabase Auth redirect allow list.
3. Enable Google and Discord in Supabase Authentication → Providers.
4. In Google Cloud and the Discord Developer Portal, use the provider callback shown by Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Keep `AUTH_DEMO_MODE` unset in production.

## 🗄️ Data and database setup

Pages read through the repositories in `src/lib/data`. There are no demo fixtures: a
repository either returns real rows or an empty list, and the page renders an explicit
empty state. Nothing on the site invents content it does not have.

To set up a database:

1. Add a valid PostgreSQL connection string to `DATABASE_URL`.
2. Create the schema.
3. Load the content that ships with the project.

```bash
npm run db:push
```

```bash
npm run db:seed:store && npm run db:seed:rules
```

The Drizzle schema lives in `src/lib/db/schema.ts`. Hand-written SQL migrations live in
`supabase/migrations` using the Supabase CLI's `<timestamp>_name.sql` format.

### Migrations

Create and apply migrations through the Supabase CLI:

```bash
supabase migration new <name>
```

```bash
supabase db push
```

`npm run db:apply -- <file>` runs a single SQL file directly against `DATABASE_URL`. It is
useful when the CLI is unavailable, but it does **not** record the migration in Supabase's
history — prefer `supabase db push` so local and remote stay in sync.

> **Note on migration history.** Migrations `001`–`005` are recorded as applied but were
> never executed against the current database: its tables came from `db:push`, and the
> history was baselined afterwards. Their policies and functions are re-created by
> `008_restore_rls_policies.sql`. Treat a fresh database as the only reliable way to
> replay the full migration chain.

Migrations are numbered sequentially (`001_…`, `002_…`). The Supabase CLI accepts this and
orders by the numeric prefix. Note that `supabase migration new` generates a 14-digit
timestamp name instead; either is valid, and timestamps sort after the numbered files, so
new migrations still land last. Rename a generated file if you want the sequence kept
consistent — and if you do, update its `version` in
`supabase_migrations.schema_migrations` to match, or the CLI will treat it as unapplied.

### Row level security

Every table in `public` has RLS enabled. Public content (products, rules, profiles,
gallery) is world-readable; user-owned data (orders, tickets, appeals, notifications,
Minecraft links, vote history) is restricted to its owner and staff, and `audit_logs` and
`site_settings` are admin-only. Role checks use the `is_staff()` / `is_admin()` helpers,
which read `profiles.role`.

The application itself connects with a role that bypasses RLS, so these policies protect
direct PostgREST/anon-key access rather than the app's own queries. Authorization for
app traffic is enforced in server actions and route guards.

## 🗂️ Project structure

```text
src/
  app/                 Route groups, pages, API routes, metadata, and layouts
  components/
    account/           Personal account panels shared by member and staff areas
    admin/             Administration UI, control room, and rules editor
    dashboard/         Member dashboard UI
    layout/            Header, navigation, footer, and mobile drawer
    shared/            Reusable cards, forms, live status, and content blocks
    theme/             Theme controls and persistence
    ui/                UI primitives
  lib/
    actions/           Validated server actions
    auth/              Session abstraction and the role ladder
    data/              Data repositories and live integrations
    db/                Database client and Drizzle schema
    image-hosts.ts     Which remote image hosts next/image may optimise
    site.ts            Server identity, navigation, social, and footer configuration
  styles/
    globals.css        Design tokens, themes, shell layout, and anything genuinely site-wide
    store-pages.css    /store and /store/[slug]
    vote-pages.css     /vote
    news-pages.css     /news and /news/[slug]
    dashboard-panels.css  /dashboard and /admin account panels
    store-vote-responsive.css  Narrow-viewport store menus and the vote table
public/images/         Logo, Minecraft artwork, avatars, and content imagery
supabase/migrations/   PostgreSQL migrations
docs/                  Maintainer documentation
```

For architecture, live integrations, theme behavior, and deployment notes, see [docs/README.md](docs/README.md).

## ⚡ Front-end performance rules

These are the constraints the current Lighthouse numbers depend on. Breaking one
is easy to do by accident and hard to notice.

- **Anything imported by `src/app/layout.tsx` is render-blocking on every route.**
  Route-specific CSS belongs in a route-scoped sheet imported by the page that
  renders it — that is why `store-pages.css`, `vote-pages.css`, `news-pages.css`
  and `dashboard-panels.css` exist. `globals.css` is for design tokens, the
  shell, and things genuinely reachable everywhere (the auth modal and the cart
  drawer both live in the root providers, so their styles are global on purpose).
- **When splitting CSS, keep two invariants.** A rule may only move if no rule
  staying behind writes the same selector — the extracted file loads later, so a
  split selector flips which declaration wins. And the page's `import` order must
  mirror the order the rules previously cascaded in. The imports carry comments
  saying so; do not reshuffle them.
- **No JavaScript animation runtime.** Scroll reveals use an IntersectionObserver
  that toggles `data-reveal`; the cart drawer uses `.cart-drawer-layer[data-open]`
  with a matching unmount delay in `cart-drawer.tsx`. Both handle
  `prefers-reduced-motion` in CSS by dropping the transform and keeping the
  opacity cross-fade. Do not reach for an animation library to do a fade or slide.
- **Only the LCP element should be a `priority` image.** `priority` emits a
  `<link rel="preload">` into `<head>`, and preloads are consumed in document
  order — a full-viewport `priority` image rendered before the hero (a splash
  screen, for example) will beat the real LCP element to the network. The hero
  also sets `fetchPriority="high"` explicitly, because `priority` alone does not
  put that attribute on the `<img>`.
- **Large decorative art referenced from CSS must be pre-sized.** A CSS
  `background-image` bypasses `next/image` entirely: no resizing, no format
  conversion, no lazy loading. Ship it already compressed at the size it renders.
- **Remote images go through `next/image` only via `isOptimisableImage`.** Some
  URLs in this app are snapshots of whatever a profile pointed at when a record
  was written, so the host set is open-ended and an unconfigured host passed to
  `<Image>` is a runtime error. Check the host, fall back to `<img>`, and keep
  `src/lib/image-hosts.ts` in step with `images.remotePatterns`.

## 🧹 Repository hygiene

- Do not commit `.next`, `.next-dev`, `node_modules`, log files, TypeScript build metadata, or local environment files.
- Keep shared components only when they have a real consumer; lint and strict TypeScript checks run with zero warnings.
- The same applies to CSS: a class that no `.tsx` renders is dead weight on every visitor. Before deleting, check it is not built dynamically (`` `is-${state}` ``) and confirm a few known-live classes still survive your filter.
- Treat `public/images` as production assets: remove an image only after confirming it has no source, CSS, metadata, or documentation references — and, for store artwork, no `products.image_url` row pointing at it.
- Ship large background art as WebP. A CSS `background-image` bypasses `next/image` entirely, so no resizing, format conversion or lazy loading is applied and the raw file is what every visitor downloads. The same artwork went from 2.1 MB as PNG to 143 KB as WebP.
- Give repeated list and grid thumbnails `loading="lazy"`, but leave above-the-fold imagery eager — lazy-loading a hero or header logo delays Largest Contentful Paint instead of improving it.
- Use `npm ci` after lockfile changes and run the full quality gate before handing work off.

## 🚢 Production notes

- Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin.
- Configure a production Postgres database before enabling persistent forms or account data.
- Configure Supabase Auth, provider credentials, and the production callback allow list before launch.
- Replace placeholder social destinations in `src/lib/site.ts` with official Mazora accounts.
- Store all server-only secrets in the deployment platform, never in public environment variables or source control.
- Set the Discord order variables in the deployment platform, not just locally — order tickets need `DISCORD_GUILD_ID`, `DISCORD_STORE_TICKETS_CATEGORY_ID` and `DISCORD_STORE_STAFF_ROLE_ID` present in the deployed environment. Discord delivers button clicks to the deployed Interactions Endpoint URL, so a locally-configured bot has no effect in production.
- No card payments are taken. The storefront places manual order requests that staff confirm and fulfil through Discord tickets; there is no payment processor integration.

## 🔎 SEO

- `https://mazora.us` is the canonical production origin. Configure and verify HTTP, `www`, and Vercel deployment-domain redirects in the Vercel project; the application keeps canonical metadata pinned to the apex if a deployment URL is misconfigured.
- Page metadata, Open Graph data, canonical links, structured data, `robots.txt`, and `sitemap.xml` are generated by the Next.js app.
- Authentication, dashboard, admin, cart, and API surfaces are excluded from search indexing. Public routes such as `/staff` remain indexable.

## 🛡️ Security

- Supabase Auth supplies verified sessions; administrative pages and every privileged server action enforce role checks on the server.
- Database row-level security protects user-owned data, and server-only credentials must never use a `NEXT_PUBLIC_` prefix.
- Production responses use a nonce-based Content Security Policy together with HSTS, clickjacking, MIME-sniffing, referrer, and permissions protections.
- Report security issues privately to the repository maintainers rather than opening a public issue containing exploit details or credentials.

## 🤝 Contributing and CI

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local workflow and pull-request expectations. GitHub Actions validates installation, linting, TypeScript, tests, and the production build on pushes and pull requests. Dependabot checks non-major npm and GitHub Actions updates monthly; updates are never auto-merged.

## 📄 License

This repository does not currently include a software license. No permission to copy, redistribute, or reuse the code is granted by default; contact the repository owner before doing so.

## 📌 Status

The core platform is implemented and in a phased production rollout. The public website, responsive homepage, full light/dark theme support, Supabase authentication with Google and Discord OAuth, database-backed content management, Discord store ordering with ticket lifecycle, role-based admin control room, member dashboard, permissions system, player management, and Minecraft skin avatar integration are implemented. Database content is optional for local development — pages show clean empty states when unconfigured. Live provider credentials and production integration configuration remain deployment-phase work.

---

Mazora Network is an independent Minecraft community and is not affiliated with Mojang Studios or Microsoft.
