import type { User, UserIdentity } from "@supabase/supabase-js";

/**
 * Which Google or Discord logins on an account the site trusts.
 *
 * The site only links a provider after "Confirm it's you" (oauthAction), but
 * Supabase's own API links one for anyone holding the account's session token:
 * a copied cookie is enough to add a lasting way in that survives a password
 * change. So the account keeps, in server-only app_metadata, the identity ids
 * it trusts, and anything else is removed (lib/auth/linked-logins).
 *
 * An identity is trusted when:
 * - it was there when the list was first written (migration 085, or the first
 *   time the account is seen without one);
 * - the site's own link flow added it (the callback, while `link_pending` names
 *   that provider);
 * - the provider has verified that its address is the account's own confirmed
 *   email: Supabase links a provider by itself only then, so it is a sign-in
 *   with Google/Discord on the same inbox, which a copied session cannot make.
 */

export type LinkedLoginUser = Pick<User, "email" | "email_confirmed_at" | "app_metadata" | "identities">;

/** How long a link started on the site may take to come back to the callback. */
export const LINK_PENDING_MS = 10 * 60_000;

/** Sign-in methods that are not a provider login: the account's own email or phone. */
const OWN_METHODS = new Set(["email", "phone"]);

/** "Google", "Discord", or the provider key capitalised. */
export function providerName(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "discord") return "Discord";
  const clean = provider.replace(/[^a-z0-9_-]/gi, "").slice(0, 30);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Provider";
}

export function isLinkedLogin(identity: Pick<UserIdentity, "provider">): boolean {
  return !OWN_METHODS.has(identity.provider);
}

/** The row id of an identity (auth.identities.id); `id` is the provider's own user id. */
export function identityRowId(identity: Pick<UserIdentity, "identity_id">): string | null {
  return typeof identity.identity_id === "string" && identity.identity_id ? identity.identity_id : null;
}

/** The trusted ids, or null when the account has no list yet. */
export function trustedIdentityIds(meta: Record<string, unknown> | undefined): string[] | null {
  const value = meta?.trusted_identities;
  if (!Array.isArray(value)) return null;
  return value.filter((id): id is string => typeof id === "string");
}

/** The provider a link started on the site is waiting for, while it may still arrive. */
export function pendingLinkProvider(meta: Record<string, unknown> | undefined, now: number): string | null {
  const value = meta?.link_pending;
  if (!value || typeof value !== "object") return null;
  const { provider, until } = value as { provider?: unknown; until?: unknown };
  if (typeof provider !== "string" || typeof until !== "number" || until <= now) return null;
  return provider;
}

/**
 * The provider vouches for the account's own confirmed address. Verified only:
 * a Discord account can carry any address unconfirmed, so a copied session
 * could otherwise link one made with the member's address.
 */
function sameAddress(identity: Pick<UserIdentity, "identity_data">, user: LinkedLoginUser): boolean {
  const inbox = user.email_confirmed_at ? user.email?.trim().toLowerCase() : "";
  const data = identity.identity_data;
  const address = data?.email;
  return Boolean(inbox) && data?.email_verified === true && typeof address === "string" && address.trim().toLowerCase() === inbox;
}

export type LinkedLoginReview =
  | { baseline: true }
  | {
      baseline: false;
      /** Ids to add to the trusted list. */
      trust: string[];
      /** Logins nobody added through the site: removed. */
      remove: Array<{ id: string; provider: string }>;
    };

/** What to do about the account's provider logins right now. Pure. */
export function reviewLinkedLogins(user: LinkedLoginUser, now: number): LinkedLoginReview {
  const trusted = trustedIdentityIds(user.app_metadata);
  if (!trusted) return { baseline: true };
  const known = new Set(trusted);
  const pending = pendingLinkProvider(user.app_metadata, now);
  const trust: string[] = [];
  const remove: Array<{ id: string; provider: string }> = [];
  for (const identity of user.identities ?? []) {
    const id = identityRowId(identity);
    if (!id || !isLinkedLogin(identity) || known.has(id)) continue;
    if (sameAddress(identity, user)) trust.push(id);
    // The site's own link is on its way back to the callback, which trusts it.
    else if (identity.provider === pending) continue;
    else remove.push({ id, provider: identity.provider });
  }
  return { baseline: false, trust, remove };
}

/**
 * The login the site's own link flow just added, for the callback to trust:
 * the one untrusted identity of the pending provider. Two of them means
 * something else linked one too, so neither is trusted (both are then removed).
 */
export function pendingLinkToTrust(user: LinkedLoginUser, now: number): string | null {
  const pending = pendingLinkProvider(user.app_metadata, now);
  const trusted = trustedIdentityIds(user.app_metadata);
  if (!pending || !trusted) return null;
  const known = new Set(trusted);
  const fresh = (user.identities ?? []).filter((identity) => {
    const id = identityRowId(identity);
    return identity.provider === pending && id !== null && !known.has(id);
  });
  return fresh.length === 1 ? identityRowId(fresh[0]!) : null;
}
