/**
 * Reading a premium player's skin straight from Mojang, for the head route
 * (/api/minecraft/skin/[username]/head). Pure, so the parsing and the host pin
 * are tested directly.
 *
 * mc-heads.net used to be the only source for players without an uploaded
 * skin. It caches each image size separately and can serve the default skin
 * for a premium name long after the player set one, so the same player showed
 * their skin on one page and Steve on another.
 */

/** A Mojang profile id: 32 hex digits, no dashes. */
export function mojangProfileId(value: unknown): string | null {
  const id = (value as { id?: unknown } | null)?.id;
  return typeof id === "string" && /^[0-9a-f]{32}$/i.test(id) ? id.toLowerCase() : null;
}

/**
 * The skin file URL in a session-server profile, or null when the player uses
 * the default skin or the answer is malformed.
 *
 * Only Mojang's texture host is accepted: the URL comes from a response, and
 * the route fetches it, so it must not be able to name any other server.
 * Mojang still sends http:// links; they are upgraded to https.
 */
export function mojangSkinTextureUrl(profile: unknown): string | null {
  const properties = (profile as { properties?: unknown } | null)?.properties;
  if (!Array.isArray(properties)) return null;
  const textures = properties.find(
    (entry): entry is { name: string; value: string } =>
      Boolean(entry) && (entry as { name?: unknown }).name === "textures" && typeof (entry as { value?: unknown }).value === "string",
  );
  if (!textures) return null;

  let raw: unknown;
  try {
    raw = (JSON.parse(Buffer.from(textures.value, "base64").toString("utf8")) as { textures?: { SKIN?: { url?: unknown } } })
      .textures?.SKIN?.url;
  } catch {
    return null;
  }
  if (typeof raw !== "string") return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname !== "textures.minecraft.net" || url.port || url.username || url.password) return null;
    if (!/^\/texture\/[0-9a-f]{16,128}$/i.test(url.pathname) || url.search || url.hash) return null;
    return `https://textures.minecraft.net${url.pathname}`;
  } catch {
    return null;
  }
}
