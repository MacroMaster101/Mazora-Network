/**
 * Whether a passkey assertion says the device verified the member.
 *
 * WebAuthn authenticator data is: rpIdHash (32 bytes), then one flags byte.
 * Bit 0x01 (UP) means someone was present; bit 0x04 (UV) means the device
 * checked them with a fingerprint, face or PIN. Only UV makes a passkey count
 * as two factors, which is what GitHub requires before it skips 2FA.
 *
 * Call only after Supabase verifies the same strictly parsed assertion (see
 * assertion-schema.ts). This helper reads flags; it does not verify a signature
 * or establish that arbitrary client-supplied bytes are authentic.
 * Anything malformed reads as "not verified": the member is simply asked for
 * the authenticator code.
 */
export function assertionUserVerified(credential: unknown): boolean {
  if (!credential || typeof credential !== "object") return false;
  const response = (credential as { response?: unknown }).response;
  if (!response || typeof response !== "object") return false;
  const encoded = (response as { authenticatorData?: unknown }).authenticatorData;
  if (typeof encoded !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) return false;
  const data = Buffer.from(encoded, "base64url");
  if (data.length < 37) return false;
  const flags = data[32] ?? 0;
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  return userPresent && userVerified;
}
