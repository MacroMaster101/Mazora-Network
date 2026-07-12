# Mazora Network maintainer guide

This document explains the current project architecture and the operational details that are easy to miss when working only from individual components.

## Rendering model

The site uses the Next.js App Router. Public pages are primarily Server Components; interactive controls such as the theme switcher, mobile drawer, copy buttons, galleries, forms, and scroll-aware header are Client Components.

Development output uses `.next-dev`; optimized builds use `.next`. Keeping the directories separate prevents an active development server from losing its manifests when a production build runs. Both generated directories are excluded from Git and ESLint.

The homepage is intentionally compact:

1. Full-height Minecraft hero with Java and Discord live status
2. Latest news board
3. Network summary and connection actions
4. Responsive site footer

The background continues from the hero through the content and footer. Section borders are avoided so the page reads as one continuous Minecraft world.

## Theme behavior

Theme state is managed by the providers and controls in `src/components/theme`. Semantic color variables are defined in `src/styles/globals.css` and mapped into Tailwind in `tailwind.config.ts`.

Light and dark modes share the same background artwork. They change component surfaces, borders, text, and contrast rather than replacing the world image. When adjusting a component, always preview both themes because translucent cards inherit significant color from the background.

## Header behavior

Desktop navigation is centered, with the logo on the left and theme/account actions on the right. It has no full-width glass card or persistent background.

`src/components/layout/scroll-header.tsx` controls visibility:

- visible at the top of the page;
- hidden while scrolling down;
- held hidden over the middle of the homepage hero to prevent collisions with hero content;
- restored after an intentional upward scroll below the hero;
- quicker to restore on mobile than desktop.

The mobile header contains a cropped logo and menu button. The logo crop compensates for transparent space inside the source PNG; do not replace its CSS sizing with ordinary full-image scaling without checking a 390 px viewport.

The drawer starts with all dropdown groups collapsed. Its backdrop is not an accessible button; the explicit close button is the single reliable close target for keyboard and automated interaction.

## Live Minecraft status

`src/lib/data/status.ts` fetches Minecraft server data on the server and normalizes common status API shapes. The default endpoint is:

```text
https://api.mcsrvstat.us/3/mc.mazora.us
```

Set `MINECRAFT_STATUS_API_URL` to use a custom proxy or plugin API. Responses are cached for 300 seconds. Errors return `live: false` and zero/unavailable display states.

The `/api/status` route exposes the normalized site status for same-origin clients.

## Live Discord counts

`src/lib/data/discord.ts` extracts the invite code from `site.discord` and requests Discord's invite endpoint with `with_counts=true`. It returns approximate member and presence counts and caches them for 300 seconds.

The default invite is:

```text
https://discord.gg/ZPrzyGpMyt
```

Set `NEXT_PUBLIC_DISCORD_INVITE_URL` only when the official invite changes. Invalid invites fail safely and show a join action without invented numbers.

## Data repositories

UI routes should not import the database driver directly. Read through `src/lib/data` and write through validated server actions in `src/lib/actions`.

`getDb()` returns:

- a Drizzle/Neon database instance when `DATABASE_URL` exists;
- `null` in zero-config mode, allowing repositories to use typed fixtures.

Support submissions require a session. Persistence requires a configured database. The current authentication abstraction is demonstrational and must be replaced before real accounts or sensitive moderation data are enabled.

## Database changes

Change the schema in `src/lib/db/schema.ts`, then run:

```bash
npm run db:generate
npm run typecheck
```

Review generated SQL before applying it. For a development database, `npm run db:push` can apply the schema directly. `npm run db:seed` loads environment variables from `.env`.

## Quality gates

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

## Dependency security

Run `npm audit --omit=dev` for production dependency risk. The project uses patched Drizzle ORM releases because older versions had an identifier-escaping advisory.

The current Drizzle Kit dependency tree may report a moderate development-server advisory in a legacy nested esbuild package. It is not shipped in the production dependency set, and npm currently offers no compatible non-breaking remediation for that transitive package. Do not use `npm audit fix --force`; it proposes an incompatible Drizzle Kit downgrade.

## Deployment checklist

1. Run all quality gates.
2. Set the canonical HTTPS site URL.
3. Configure Postgres and apply reviewed migrations.
4. Replace demo authentication with a secure provider.
5. Set server-only secrets in the host environment.
6. Confirm the Java status endpoint and Discord invite from the deployed server.
7. Replace placeholder social links.
8. Test both themes and mobile/desktop layouts on the deployed URL.
9. Keep payment actions disabled until a real provider and server-side verification are implemented.
