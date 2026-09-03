/** Token values for one refresh. `null` means "we do not know this right now". */
export type PresenceTokens = Record<string, string | null>;

const TOKEN = /\{([a-z_]+)\}/g;

/**
 * Substitute `{token}` placeholders, or refuse.
 *
 * Returns null if any referenced token is missing or null. That is the whole
 * point: a presence line claiming `0/100` when the probe simply failed is
 * worse than no line at all, and this worker's rule is to never display a
 * number it does not have.
 */
export function renderTemplate(template: string, tokens: PresenceTokens): string | null {
  let unresolved = false;

  const text = template.replace(TOKEN, (_match, name: string) => {
    const value = tokens[name];
    if (value === undefined || value === null) {
      unresolved = true;
      return "";
    }
    return value;
  });

  return unresolved ? null : text;
}

/**
 * The text one status contributes this cycle, or null to skip it.
 *
 * The fallback exists so an offline service still says so. Without it, a
 * Minecraft server going down would silently drop its line from the rotation
 * instead of reporting `Offline`, which is information the operator has and
 * would want shown.
 */
export function resolveStatusText(
  status: { template: string; fallbackTemplate: string | null },
  tokens: PresenceTokens,
): string | null {
  const primary = renderTemplate(status.template, tokens);
  if (primary !== null) return primary;
  if (status.fallbackTemplate === null) return null;
  return renderTemplate(status.fallbackTemplate, tokens);
}
