<div align="center">

# 🎮 Mazora Network

**A production-grade Minecraft server community platform.**

Built with the Next.js App Router, TypeScript, and a custom dark, cinematic "game-HUD" design system —
zero-config by default, backed by Postgres when you're ready.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech)

</div>

---

## ✨ Overview

Mazora Network is a full-featured community site for a Minecraft server — the kind of platform you'd
actually run in production, not a template. **Phase 1** ships the complete public-facing site plus
scaffolded authenticated areas, and it runs with **zero configuration**: no database, no env vars,
no setup. Add a `DATABASE_URL` when you're ready to go live, and every page seamlessly switches from
typed demo data to real Postgres — no code changes required.

| | |
|---|---|
| 🧊 **Zero-config** | Runs instantly on in-memory demo data — no database needed to explore it |
| 🐘 **Neon → Supabase** | Same Postgres schema either way; swap by changing one env var |
| 🎨 **Custom design system** | Dark, cinematic "game-HUD" aesthetic, built from scratch in Tailwind |
| 🔒 **Type-safe end to end** | TypeScript + Zod-validated server actions + Drizzle schema |
| 🧭 **Honest by default** | Live server status shows "temporarily unavailable" instead of faking numbers |

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org) (App Router, Server Components, Server Actions) |
| **UI** | [React 19](https://react.dev) · [TypeScript 5](https://www.typescriptlang.org) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com) · custom design tokens |
| **Animation** | [Framer Motion](https://www.framer.com/motion/) |
| **Icons** | [Lucide](https://lucide.dev) |
| **Database** | [Postgres](https://www.postgresql.org) via [Neon](https://neon.tech) (serverless driver) — swappable to [Supabase](https://supabase.com) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) + Drizzle Kit |
| **Validation** | [Zod](https://zod.dev) |
| **Auth (Phase 2)** | [Supabase Auth](https://supabase.com/auth) via `@supabase/ssr` |
| **Tooling** | `tsx`, ESLint, PostCSS, Autoprefixer |

---

## 🚀 Quick start

```bash
npm install
cp .env.example .env.local   # optional — the site runs without any env vars
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**. With no environment variables set, the entire
public site runs on in-memory demo content — nothing to configure.

---

## 📦 What's included

<details>
<summary><b>🌐 Public site</b> — fully built</summary>

Home, play guide, live status, game modes + detail pages, player directory + profiles,
leaderboards, news + articles, events + detail pages, rules, staff, gallery (lightbox),
Discord, voting, store + product pages, cart, and the full support center
(ban appeals, report player, report bug, suggestions).

</details>

<details>
<summary><b>🔐 Authentication</b> — Phase-1 demo</summary>

Login, register, forgot/reset password, and email verification screens, backed by a
swappable session abstraction (`src/lib/auth`).

</details>

<details>
<summary><b>📊 User dashboard</b></summary>

Overview, Minecraft account linking flow, statistics, tickets, appeals, reports, events,
votes, purchases, notifications, and settings.

</details>

<details>
<summary><b>🛡️ Admin dashboard</b></summary>

Role-gated overview, users, players, content management tables (news, events, game modes,
rules, gallery, staff, store), moderation queues, orders, voting, notifications, site
settings, and audit logs.

</details>

<details>
<summary><b>🗄️ Data layer</b></summary>

Drizzle schema mirroring a normalized Postgres design, a repository layer
(`src/lib/data`) that every page reads through, a seed script, and graceful fallback to
demo data when no database is connected.

</details>

<details>
<summary><b>⚙️ Cross-cutting</b></summary>

Cached + validated Minecraft status proxy, Zod-validated server actions, sitemap, robots,
per-page metadata/OpenGraph, and loading/empty/error states throughout.

</details>

---

## 🐘 Database: Neon now, Supabase later

Both Neon and Supabase are PostgreSQL under the hood, so migrating between them is just a
connection string swap.

```bash
# 1. Set a Neon connection string
echo 'DATABASE_URL=postgres://...neon.tech/db?sslmode=require' >> .env.local

# 2. Create the tables from the Drizzle schema
npm run db:push

# 3. Seed Phase-1 demo content
npm run db:seed
```

Pages never import the database driver directly — they call `src/lib/data/*`. Pointing at
Supabase later just means changing `DATABASE_URL` (and, in Phase 2, swapping the auth
abstraction for Supabase Auth). **No page changes required.**

---

## 🔑 Environment variables

Everything is optional — see [`.env.example`](.env.example) for the full template.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon (now) or Supabase (later) Postgres connection string |
| `MINECRAFT_STATUS_API_URL` | Live server status source |
| `MINECRAFT_PLUGIN_SECRET` | Shared secret for the account-link plugin endpoint |
| `NEXT_PUBLIC_SITE_URL` | Public site URL |
| `NEXT_PUBLIC_DISCORD_INVITE_URL` | Discord invite link |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reserved for Phase 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | Reserved for Phase 2 |

> ⚠️ **Never** expose the service-role key or plugin secret to the browser.

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the codebase |
| `npm run typecheck` | Type-check with no emit |
| `npm run db:generate` | Generate Drizzle migrations from the schema |
| `npm run db:push` | Push the schema straight to the database |
| `npm run db:seed` | Seed Phase-1 demo content |

## ✅ Verification

```bash
npm run typecheck
npm run build
```

---

## 🧭 Phase 1 scope

Payments are architecture-only — **no charges are processed**. Full auth/RLS, Minecraft
stat sync, admin write operations, and notifications are scaffolded for later phases.
See [`docs/superpowers/specs`](docs/superpowers/specs) for the full design and plan.

---

<div align="center">

Not affiliated with Mojang Studios or Microsoft.

</div>
