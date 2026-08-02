# 🛠️ Mazora Network maintainer guide

This document explains the current project architecture and the operational details that are easy to miss when working only from individual components.

## 🧩 Rendering model

The site uses the Next.js App Router. Public pages are primarily Server Components; interactive controls such as the theme switcher, mobile drawer, copy buttons, galleries, forms, and scroll-aware header are Client Components.

Development output uses `.next-dev`; optimized builds use `.next`. Keeping the directories separate prevents an active development server from losing its manifests when a production build runs. Both generated directories are excluded from Git and ESLint.

Detail routes (`store/[slug]`, `news/[slug]`, `game-modes/[slug]`, `players/[username]`, `events/[slug]`) declare `export const dynamic = "force-dynamic"` and no longer use `generateStaticParams`. Prerendering them was actively wrong here: their content lives in the database, so a product or article added through the admin only appeared after a rebuild, and `notFound()` returned HTTP 200 with the 404 body — a soft 404 that search engines index as a real page. Because these pages already render in tens of milliseconds, per-request rendering costs little and keeps them correct and current.

The homepage is intentionally compact:

1. Full-height Minecraft hero with Java and Discord live status
2. Latest news board
3. Network summary and connection actions
4. Responsive site footer

The background continues from the hero through the content and footer. Section borders are avoided so the page reads as one continuous Minecraft world.

## 🌓 Theme behavior

Theme state is managed by the providers and controls in `src/components/theme`. Semantic color variables are defined in `src/styles/globals.css` and mapped into Tailwind in `tailwind.config.ts`.

Light and dark modes share the same background artwork. On a first visit, the no-flash boot script follows the device preference; after the visitor chooses light or dark, that explicit choice is stored locally. The two visible choices keep desktop and mobile controls consistent. Themes change component surfaces, borders, text, and contrast rather than replacing the world image. Always preview both themes because translucent cards inherit significant color from the background.

## 🧭 Header behavior

Desktop navigation is centered, with the logo on the left and theme/account actions on the right. It has no full-width glass card or persistent background.

`src/components/layout/scroll-header.tsx` controls visibility:

- visible at the top of the page;
- hidden while scrolling down;
- held hidden over the middle of the homepage hero to prevent collisions with hero content;
- restored after an intentional upward scroll below the hero;
- quicker to restore on mobile than desktop.

The mobile header contains a cropped logo and menu button. The logo crop compensates for transparent space inside the source PNG; do not replace its CSS sizing with ordinary full-image scaling without checking a 390 px viewport.

The drawer starts with all dropdown groups collapsed. Its backdrop is not an accessible button; the explicit close button is the single reliable close target for keyboard and automated interaction.

## ⛏️ Live Minecraft status

`src/lib/data/status.ts` fetches Minecraft server data on the server and normalizes common status API shapes. The default endpoint is:

```text
https://api.mcsrvstat.us/3/mc.mazora.us
```

Set `MINECRAFT_STATUS_API_URL` to use a custom proxy or plugin API. Responses are cached for 300 seconds. Errors return `live: false` and zero/unavailable display states.

The `/api/status` route exposes the normalized site status for same-origin clients.

## 💬 Live Discord counts

`src/lib/data/discord.ts` extracts the invite code from `site.discord` and requests Discord's invite endpoint with `with_counts=true`. It returns approximate member and presence counts and caches them for 300 seconds.

The default invite is:

```text
https://discord.gg/ZPrzyGpMyt
```

Set `NEXT_PUBLIC_DISCORD_INVITE_URL` only when the official invite changes. Invalid invites fail safely and show a join action without invented numbers.

## 🗄️ Data repositories

UI routes should not import the database driver directly. Read through `src/lib/data` and write through validated server actions in `src/lib/actions`.

`getDb()` returns:

- a Drizzle instance over the Supabase Postgres database when `DATABASE_URL` exists;
- `null` in zero-config mode, in which repositories return empty results and pages render
  their empty states.

Support submissions require a session, and persistence requires a configured database. Production authentication uses Supabase SSR cookies and the PKCE callback flow when the Supabase variables are configured. Email/password, Google, and Discord paths are implemented; provider credentials and callback allow lists still need to be configured in Supabase before deployment. `AUTH_DEMO_MODE` is strictly for local UI previews and must remain disabled in production.

## 🧬 Database changes

Change the schema in `src/lib/db/schema.ts`, then run:

```bash
npm run db:generate
npm run typecheck
```

Review generated SQL before applying it. For a development database, `npm run db:push` can
apply the schema directly.

Hand-written SQL (RLS policies, functions, triggers) lives in `supabase/migrations` using
the Supabase CLI's `<timestamp>_name.sql` naming. Create one with `supabase migration new
<name>` and apply it with `supabase db push`. Write migrations idempotently — `add column
if not exists`, `drop policy if exists` before `create policy`, `create or replace
function` — so re-running one is a safe no-op.

`npm run db:apply -- <file.sql>` applies a single file straight through `DATABASE_URL`.
It is a fallback for when the CLI is unavailable and does not record the migration in
Supabase's history.

Content seeds: `npm run db:seed:store` (storefront catalogue) and `npm run db:seed:rules`
(community rulebook). Re-running the rules seed replaces the rules inside the baseline
categories, overwriting edits made in `/admin/rules`; categories you created yourself are
left alone.

## ✅ Quality gates

Every completed change should pass:

```bash
npm run lint
npm run typecheck
npm run build
```

For visual changes, also test:

- desktop at approximately 1440 × 900;
- mobile at approximately 390 × 844;
- light and dark themes;
- initial page load and upward/downward navigation behavior;
- mobile drawer open, dropdown, theme switch, and close interactions;
- the entire page through the legal footer row;
- horizontal overflow and browser console errors.

## 🧹 Repository hygiene

Generated directories (`.next`, `.next-dev`, and `node_modules`), `*.log`, `*.tsbuildinfo`, and local environment files are ignored and should never be reviewed as source changes. Before removing a source file or image, verify references in TypeScript, CSS, metadata, and Markdown. Keep the lockfile committed and use `npm ci` for reproducible installs.

If a development cache produces route-type errors after route groups or slots change, stop duplicate dev servers, remove `.next-dev`, and rerun `npm run typecheck`. Do not commit a generated cache as a workaround.

## 🔒 Dependency security

Run `npm audit --audit-level=moderate` for the complete dependency tree and `npm audit --omit=dev --audit-level=high` for production-only risk. Both current audits report zero vulnerabilities. Review automated upgrades deliberately; never use `npm audit fix --force` without checking framework and Drizzle compatibility.

Next.js may print an Edge-runtime compatibility warning from `@supabase/supabase-js` while bundling the session-refresh middleware. The optimized build still succeeds. Do not silence it by forcing middleware to the Node.js runtime: with the current broad matcher, that makes public routes dynamic. Recheck the warning after Supabase or Next.js upgrades.

## 🚀 Deployment checklist

1. Run all quality gates.
2. Set the canonical HTTPS site URL.
3. Configure Postgres and apply reviewed migrations.
4. Configure Supabase Auth, provider credentials, callback URLs, and production session policies.
5. Set server-only secrets in the host environment.
6. Confirm the Java status endpoint and Discord invite from the deployed server.
7. Replace placeholder social links.
8. Test both themes and mobile/desktop layouts on the deployed URL.
9. Set the Discord order variables in the host environment and point the Interactions Endpoint URL at the deployed domain. Discord verifies the endpoint when you save it, and button clicks never reach a local dev server, so order tickets only work once this is done from production.
10. Grant the bot role View Channels, Manage Channels, Send Messages and Read Message History on the ticket category, plus View Channel, Send Messages, Embed Links and Attach Files in the closed-tickets archive channel. Without archive access, closing safely keeps the live ticket.
11. Keep card payment actions disabled until a real provider and server-side verification are implemented. The manual Discord order flow is live and takes no payment on the site.
