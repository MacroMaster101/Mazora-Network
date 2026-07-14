/**
 * Bootstrap / manual role setter. Sets a user's app_metadata.role directly via
 * the Supabase service-role key. Use this to grant the FIRST it/owner account,
 * after which roles are managed in-app at /admin/users.
 *
 * Usage: npm run role:set -- <email> <role>
 *   e.g. npm run role:set -- you@example.com it
 */
import { createClient } from "@supabase/supabase-js";

const ROLES = ["member", "vip", "helper", "moderator", "administrator", "owner", "it"];

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role) {
    console.error("Usage: npm run role:set -- <email> <role>");
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Valid: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Find the user by email (paginate through users).
  let userId: string | undefined;
  let username: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(error.message); process.exit(1); }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) { userId = match.id; username = String(match.user_metadata?.username ?? ""); }
    if (data.users.length < 200) break;
  }
  if (!userId) { console.error(`No user found with email ${email}.`); process.exit(1); }

  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`Set ${email}${username ? ` (${username})` : ""} to role "${role}". They must re-login for it to take effect.`);
  process.exit(0);
}

main();
