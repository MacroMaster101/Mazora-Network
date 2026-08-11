# Mazora production launch workflow

## Launch mode

Launch mode is controlled by one server environment variable:

```env
MAZORA_LAUNCH_MODE=on
```

Launch mode is intentionally **on by default**. Set it to `off` only when you want every implementation to be reachable again.

When launch mode is on, unfinished URLs keep their original address but render the polished launch-status page. Their original page files and code are not deleted.

## Routes held for a later phase

- Forums
- Player directory and player profiles
- Leaderboards
- Player reports, bug reports and suggestions
- Dashboard subpages except settings, Minecraft linking, statistics and purchases; the dashboard overview remains available

Home, Play, Status, Game Modes, Gallery, News, Events, Team, Rules, Discord, voting, Store, Support Center, appeals, staff applications, content-creator applications, legal pages, authentication and the dashboard overview remain available.

The launch list lives in `src/lib/launch.ts`. To release one feature, remove only its entry from `launchGates`, run the checks below, commit and deploy. Other unfinished features stay protected.

## Local development

To work on every page locally, add this to `.env`:

```env
MAZORA_LAUNCH_MODE=off
```

Restart `npm run dev` after changing environment variables.

To preview exactly what production visitors see:

```env
MAZORA_LAUNCH_MODE=on
```

You do not need to undo the launch commit when development resumes.

## Production environment checklist

Set these in the hosting provider, not in Git:

```env
MAZORA_LAUNCH_MODE=on
NEXT_PUBLIC_SITE_URL=https://mazora.us
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
NEXT_PUBLIC_DISCORD_INVITE_URL=...
```

Keep `AUTH_DEMO_MODE` empty or remove it in production. Confirm Supabase redirect URLs include the production `/auth/callback` URL before enabling registration or social login.

## Required verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

After deployment, check:

1. Home, Play, Gallery, Rules and legal pages.
2. Store and voting open normally; Forums, Players and Leaderboards show the launch-status screen.
3. A signed-out dashboard URL sends the visitor to login.
4. A signed-in gated dashboard subpage shows the account launch-status screen, while settings, Minecraft linking, statistics and purchases remain available.
5. Login, logout, password reset and email verification use production Supabase.
6. `/sitemap.xml` excludes gated routes.
7. The Java status, Discord invite and production canonical URL are correct.

## Commit this launch preparation

Review the work first, then commit it:

```bash
git status
git diff --check
git add .env.example docs/production-launch.md src/app/sitemap.ts "src/app/(site)/launch-status/page.tsx" src/lib/launch.ts src/middleware.ts src/styles/globals.css
git commit -m "feat: prepare reversible production launch mode"
```

If the shell treats parentheses specially, quote the launch-status path.

## How to continue part by part

For each feature:

1. Set `MAZORA_LAUNCH_MODE=off` locally.
2. Finish the real database, authentication and action behavior.
3. Test signed-out, signed-in, light and dark states.
4. Remove that route's entry from `launchGates`.
5. Turn launch mode back on and verify the feature opens while the remaining gates still work.
6. Commit and deploy that feature.

If you ask Codex to continue later, say:

> Continue the phased production rollout. Keep launch mode, finish [feature], and remove only that feature from the launch gates.

Only use `git revert <launch-commit>` if you want to remove the entire launch-mode system. For normal development, set `MAZORA_LAUNCH_MODE=off` instead.
