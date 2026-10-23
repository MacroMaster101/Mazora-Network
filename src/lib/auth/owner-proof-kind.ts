/**
 * How "Confirm it's you" checks the account owner (lib/auth/owner-confirmation):
 * the authenticator code when two-step verification is on, otherwise the
 * current password, otherwise (Google or Discord only) a code emailed to the
 * account. Shared by the server check and the settings UI, so the form always
 * asks for what the server will check.
 */
export type OwnerProof = "code" | "password" | "email";

export function ownerProofKind(input: { hasAuthenticator: boolean; hasPassword: boolean }): OwnerProof {
  if (input.hasAuthenticator) return "code";
  return input.hasPassword ? "password" : "email";
}
