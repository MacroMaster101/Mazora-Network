/**
 * True when the account was invited by staff and the link has never been used.
 *
 * Shared by the invite actions and the role change so both draw the line in
 * the same place. Not a "use server" module: those may only export async
 * functions, and this is a plain predicate.
 */
export function isPendingInvite(user: {
  invited_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}) {
  return (
    Boolean(user.invited_at) &&
    !user.last_sign_in_at &&
    !user.email_confirmed_at
  );
}
