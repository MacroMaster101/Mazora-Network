import { z } from "zod";

/**
 * A startup check of the environment variables, run once per server process
 * from instrumentation.ts.
 *
 * Forty-odd variables are read straight from process.env across the code, so
 * a missing or mistyped one used to surface only when the feature behind it
 * failed, often as an empty page that looks like no data. This names the
 * problem at boot instead, in the function logs.
 *
 * It reports, it never throws: one bad optional variable must not take the
 * whole site down, and the features already fall back when theirs is missing.
 * Only variable NAMES are ever reported, never a value — several are secrets.
 */

type Env = Record<string, string | undefined>;

const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"), "must be an https:// URL");
const postgresUrl = z.string().refine((value) => /^postgres(ql)?:\/\//.test(value), "must be a postgres:// URL");
const discordId = z.string().regex(/^\d{17,20}$/, "must be a Discord id (17-20 digits)");
const secret = z.string().min(16, "must be at least 16 characters");
const email = z.string().email("must be an email address");
const flag = z.string().refine((value) => ["true", "false"].includes(value.toLowerCase()), 'must be "true" or "false"');
/** lib/launch also accepts "off". */
const launchFlag = z.string().refine((value) => ["true", "false", "on", "off"].includes(value.toLowerCase()), 'must be "true" or "false"');

/** Checked whenever the variable is set. */
const FORMATS: Record<string, z.ZodType<string>> = {
  NEXT_PUBLIC_SITE_URL: httpsUrl,
  NEXT_PUBLIC_SUPABASE_URL: httpsUrl,
  NEXT_PUBLIC_DISCORD_INVITE_URL: httpsUrl,
  NEXT_PUBLIC_DISCORD_SUPPORT_TICKETS_URL: httpsUrl,
  NEXT_PUBLIC_SERVER_MAP_URL: httpsUrl,
  MINECRAFT_STATUS_API_URL: httpsUrl,
  DISCORD_STORE_WEBHOOK_URL: httpsUrl,
  DISCORD_PRESENCE_HEALTH_URL: httpsUrl,
  UPSTASH_REDIS_REST_URL: httpsUrl,
  NEXT_PUBLIC_SUPPORT_EMAIL: email,
  DATABASE_URL: postgresUrl,
  DISCORD_APPLICATION_ID: discordId,
  DISCORD_GUILD_ID: discordId,
  DISCORD_STAFF_NOTICE_ROLE_ID: discordId,
  DISCORD_STORE_STAFF_ROLE_ID: discordId,
  DISCORD_ORDERS_CHANNEL_ID: discordId,
  DISCORD_STORE_TICKETS_CATEGORY_ID: discordId,
  DISCORD_TICKET_LOGS_CHANNEL_ID: discordId,
  DISCORD_BUYERS_CHANNEL_ID: discordId,
  DISCORD_ANNOUNCEMENTS_CHANNEL_ID: discordId,
  DISCORD_PATCH_CHANNEL_ID: discordId,
  CRON_SECRET: secret,
  MFA_RECOVERY_PEPPER: secret,
  BOT_CONFIG_SECRET: secret,
  MAZORA_LAUNCH_MODE: launchFlag,
  AUTH_DEMO_MODE: flag,
  TRUSTED_PROXY_HOPS: z.string().regex(/^[1-5]$/, "must be a whole number from 1 to 5"),
};

/** Needed in production; the site runs without them only as an empty demo. */
const REQUIRED_IN_PRODUCTION = [
  "NEXT_PUBLIC_SITE_URL",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "CRON_SECRET",
  "MFA_RECOVERY_PEPPER",
] as const;

/** At least one of each group, in production (old and new Supabase key names). */
const ONE_OF_IN_PRODUCTION = [
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
] as const;

/** Set together or not at all. */
const PAIRS = [["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]] as const;

const isSet = (env: Env, name: string) => Boolean(env[name]?.trim());

/** Problems with `env`, one line each, naming variables only. Empty when all is well. */
export function checkEnvironment(env: Env, { production }: { production: boolean }): string[] {
  const problems: string[] = [];

  for (const [name, format] of Object.entries(FORMATS)) {
    const value = env[name]?.trim();
    if (!value) continue;
    const parsed = format.safeParse(value);
    if (!parsed.success) problems.push(`${name} ${parsed.error.issues[0]?.message ?? "is not valid"}.`);
  }

  for (const [first, second] of PAIRS) {
    if (isSet(env, first) !== isSet(env, second)) problems.push(`${first} and ${second} must be set together.`);
  }

  if (production) {
    for (const name of REQUIRED_IN_PRODUCTION) {
      if (!isSet(env, name)) problems.push(`${name} is not set.`);
    }
    for (const group of ONE_OF_IN_PRODUCTION) {
      if (!group.some((name) => isSet(env, name))) problems.push(`None of ${group.join(", ")} is set.`);
    }
    if (env.AUTH_DEMO_MODE?.trim().toLowerCase() === "true") problems.push("AUTH_DEMO_MODE is on in production; it must stay off.");
  }

  return problems;
}
