/**
 * Remove every two-step verification factor from one account, for a staff
 * member who has lost their authenticator and their recovery codes. Two-step
 * verification is then off for them; they turn it on again in Settings.
 *
 * Usage: npm run mfa:reset -- <email>
 */
import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey } from "../src/lib/supabase/secret-key";

async function main() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: npm run mfa:reset -- <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = supabaseSecretKey();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set in .env.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(error.message); process.exit(1); }
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) { console.error(`No user found with email ${email}.`); process.exit(1); }

  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) { console.error(error.message); process.exit(1); }
  if (data.factors.length === 0) {
    console.log(`${email} has no two-step verification factors.`);
    process.exit(0);
  }

  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (deleteError) { console.error(deleteError.message); process.exit(1); }
  }

  // Recorded like any other privileged change, so a reset is never silent.
  await admin.from("audit_logs").insert({
    action: "auth.two_factor_reset",
    target_type: "user",
    target_id: userId,
    metadata: { email, via: "scripts/reset-mfa.ts" },
  });

  console.log(`Removed ${data.factors.length} factor(s) from ${email}. Two-step verification is now off for them.`);
  process.exit(0);
}

main();
