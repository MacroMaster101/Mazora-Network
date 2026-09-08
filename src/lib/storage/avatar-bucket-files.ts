/**
 * Who owns which file in the profile-avatars bucket.
 *
 * One bucket holds two features' files side by side in each user's folder:
 * profile photos as `avatar-<ts>.webp`, and self-uploaded Minecraft skins as
 * `skin-raw-<ts>.png` and `skin-head-<ts>.png`. Both features sweep old files
 * away, so each sweep has to know exactly what belongs to it.
 *
 * The skin sweep already did. The avatar sweep did not: it removed everything
 * in the folder except the file it had just written, which meant setting a
 * Discord photo, adopting an mc-heads skin, or simply removing your photo also
 * deleted the uploaded skin — while minecraft_accounts went on pointing at it.
 * That leaves a row referencing an object that no longer exists, and Supabase
 * answers a missing object with a 400 and a JSON body, so the browser
 * CORB-blocks the <img> and logs it.
 *
 * Kept free of `server-only` so the rule can be tested directly; the storage
 * calls that use it live in the actions.
 *
 * Nothing outside these two prefixes is ever selected. An unrecognised name is
 * something neither feature put there, and deleting what you do not recognise
 * is how an unrelated file disappears.
 */

const AVATAR_PREFIX = /^avatar-.+/;
const SKIN_PREFIX = /^skin-(raw|head)-.+/;

function select(names: string[], pattern: RegExp, keep: string[]): string[] {
  const kept = new Set(keep.map((path) => path.split("/").pop()));
  return names.filter((name) => pattern.test(name) && !kept.has(name));
}

/** Profile photos in a user's folder, excluding any path in `keep`. */
export function selectAvatarFiles(names: string[], keep: string[] = []): string[] {
  return select(names, AVATAR_PREFIX, keep);
}

/** Uploaded Minecraft skin files in a user's folder, excluding any in `keep`. */
export function selectSkinFiles(names: string[], keep: string[] = []): string[] {
  return select(names, SKIN_PREFIX, keep);
}
