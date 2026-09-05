import "server-only";

/**
 * Minimal Resend transport.
 *
 * Uses Resend's HTTP API rather than SMTP: the auth emails already go out over
 * SMTP configured inside Supabase, and that credential belongs to Supabase, not
 * to this app. This is the app's own sender, with its own key.
 *
 * Never throws. Every caller sends email as a side effect of something more
 * important — a sign-in, an order — and a mail outage must not take that with
 * it. Failures are logged and reported as `false`.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Sender address. Must be on a domain verified in Resend. */
export function mailFrom(): string | null {
  const configured = process.env.MAIL_FROM?.trim();
  return configured || null;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(message: OutgoingEmail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = mailFrom();

  // Unconfigured is a normal state (local dev, previews), not an error worth
  // a stack trace on every sign-in — so it is a quiet no-op.
  if (!key || !from) return false;
  if (!message.to.includes("@")) return false;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      // A hung mail API must not hold a sign-in open.
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      // Body, not just status: Resend explains refusals (unverified domain,
      // invalid recipient) in it, and that is the part worth having in a log.
      console.error("Resend send failed", response.status, (await response.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend send threw", error);
    return false;
  }
}
