/**
 * One rule for what counts as "the same client" when an address keys a counter
 * or a rate limit. An IPv6 client is keyed on its /64: one household, phone or
 * rented server is handed a whole /64 and can rotate through its addresses
 * freely, so keying on the full address gives it a fresh allowance each time.
 */

/** The first four hextets of an IPv6 address as a /64 prefix, or the input unchanged for anything else. */
export function normalizeClientIp(ip: string): string {
  let value = ip.trim().replace(/^\[|\]$/g, "");
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(":")) return ip;

  // An IPv4-mapped address is an IPv4 client.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) return mapped[1];

  let head: string[];
  let tail: string[] = [];
  const gap = value.indexOf("::");
  if (gap !== -1) {
    if (value.indexOf("::", gap + 1) !== -1) return ip;
    head = value.slice(0, gap).split(":").filter(Boolean);
    tail = value.slice(gap + 2).split(":").filter(Boolean);
    if (head.length + tail.length > 7) return ip;
    head = [...head, ...Array<string>(8 - head.length - tail.length).fill("0"), ...tail];
  } else {
    head = value.split(":");
  }
  if (head.length !== 8 || !head.every((h) => /^[0-9a-f]{1,4}$/i.test(h))) return ip;
  return `${head.slice(0, 4).map((h) => h.toLowerCase().padStart(4, "0")).join(":")}::/64`;
}
