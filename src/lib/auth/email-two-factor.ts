import "server-only";
import { sharedStoreConfig } from "@/lib/redis";
import { supabaseSecretKey } from "@/lib/supabase/secret-key";

/** Never advertise delivery when the mailer or single-use code store is absent. */
export function emailTwoFactorAvailable(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim() && sharedStoreConfig() && supabaseSecretKey());
}
