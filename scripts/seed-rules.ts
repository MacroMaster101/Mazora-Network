/**
 * Seed / re-seed the community rulebook into the database.
 *
 * The rulebook is staff-editable from /admin/rules, so this script is only for
 * provisioning a fresh database (or restoring the baseline set). It is safe to
 * re-run: categories are upserted by slug and their rules are replaced.
 *
 * Careful: re-running REPLACES the rules inside each seeded category, so any
 * edits made in the admin panel to those categories are overwritten. Categories
 * you added yourself are left untouched.
 *
 * Usage: npm run db:seed:rules
 */
import postgres from "postgres";

interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  items: { title: string; body: string }[];
}

const RULEBOOK: SeedCategory[] = [
  {
    slug: "general",
    name: "General",
    icon: "Shield",
    items: [
      { title: "Respect everyone", body: "Treat every player and staff member with respect. Harassment of any kind is not tolerated." },
      { title: "No impersonation", body: "Do not impersonate staff, other players, or Mazora itself." },
      { title: "Keep it appropriate", body: "Usernames, skins, and builds must be suitable for a broad audience." },
      { title: "Follow staff directions", body: "During live incidents, follow staff instructions promptly. You can always appeal afterward." },
    ],
  },
  {
    slug: "chat",
    name: "Chat",
    icon: "MessagesSquare",
    items: [
      { title: "No hate speech", body: "Slurs, hate speech, and targeted abuse result in an immediate mute or ban." },
      { title: "No spam", body: "Avoid spam, excessive caps, and disruptive formatting in public channels." },
      { title: "No advertising", body: "Advertising other servers or unrelated services is prohibited." },
      { title: "Keep chat readable", body: "Public channels stay in English so moderation remains effective." },
    ],
  },
  {
    slug: "gameplay",
    name: "Gameplay",
    icon: "Gamepad2",
    items: [
      { title: "No cheats", body: "Hacked clients, macros, and unfair automation are banned across all modes." },
      { title: "No exploits", body: "Do not exploit bugs or duplicate items. Report serious exploits privately to staff." },
      { title: "Play fair", body: "Stat-boosting and alt-farming undermine fair competition and are not allowed." },
    ],
  },
  {
    slug: "pvp",
    name: "PvP",
    icon: "Swords",
    items: [
      { title: "No spawn camping", body: "Do not repeatedly kill players at spawn or safe zones." },
      { title: "No cross-teaming", body: "Teaming in solo modes and events is prohibited." },
      { title: "Combat mods", body: "Reach, kill-aura, and auto-clickers are an instant ban." },
    ],
  },
  {
    slug: "building",
    name: "Building",
    icon: "Hammer",
    items: [
      { title: "No griefing", body: "Do not grief protected community areas or other players' claims." },
      { title: "No lag machines", body: "Deliberately harmful redstone or lag machines will be removed." },
      { title: "Respect boundaries", body: "Stay within your plot and claim boundaries." },
    ],
  },
  {
    slug: "economy",
    name: "Economy",
    icon: "Coins",
    items: [
      { title: "No real-money trades", body: "Selling in-game items for real money outside the store is banned." },
      { title: "No dupe exploits", body: "Item or currency duplication results in a wipe and ban." },
    ],
  },
  {
    slug: "trading",
    name: "Trading",
    icon: "Handshake",
    items: [
      { title: "No scamming", body: "Scamming is prohibited outside explicitly marked risky modes." },
      { title: "Honor deals", body: "Trades agreed in chat are binding; back out and you may be sanctioned." },
    ],
  },
  {
    slug: "mods-clients",
    name: "Mods & Clients",
    icon: "Cpu",
    items: [
      { title: "Allowed mods", body: "Performance and cosmetic mods (minimaps without radar, shaders) are allowed." },
      { title: "Banned mods", body: "Any mod that grants a competitive advantage is banned." },
    ],
  },
  {
    slug: "exploits",
    name: "Exploits & Bugs",
    icon: "Bug",
    items: [
      { title: "Report, don't abuse", body: "Report serious exploits privately through the support center." },
      { title: "No public sharing", body: "Publicly sharing exploits before a fix will be treated as abuse." },
    ],
  },
  {
    slug: "punishments",
    name: "Punishments",
    icon: "Gavel",
    items: [
      { title: "Escalation", body: "Punishments escalate from warnings to mutes, temp-bans, and permanent bans." },
      { title: "Appeals", body: "Every punishment can be appealed through the support center within 30 days." },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set — cannot seed the rulebook.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false });
  let categories = 0;
  let items = 0;
  try {
    for (const [index, cat] of RULEBOOK.entries()) {
      const [row] = await sql`
        insert into public.rule_categories (name, slug, icon, sort_order)
        values (${cat.name}, ${cat.slug}, ${cat.icon}, ${index})
        on conflict (slug) do update set
          name = excluded.name,
          icon = excluded.icon,
          sort_order = excluded.sort_order
        returning id`;

      await sql`delete from public.rules where category_id = ${row.id}`;
      for (const [i, item] of cat.items.entries()) {
        await sql`
          insert into public.rules (category_id, title, description, sort_order, enabled)
          values (${row.id}, ${item.title}, ${item.body}, ${i}, true)`;
        items += 1;
      }
      categories += 1;
    }
    console.log(`✓ Seeded ${categories} rule categories containing ${items} rules.`);
  } catch (err) {
    console.error("✗ Rulebook seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
