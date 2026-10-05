import { isIPv4, isIPv6 } from "node:net";

/**
 * Address ranges the server must never be talked into fetching: loopback,
 * RFC1918 private space, carrier NAT, and — most importantly — the
 * 169.254.0.0/16 link-local range that cloud providers use for their instance
 * metadata endpoints.
 */
export function isBlockedAddress(ip: string): boolean {
  if (isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Non-routable/documentation ranges must fail closed too. They are often
    // routed internally by development networks and cloud sidecars even
    // though they are not ordinary RFC1918 space.
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51) return true;
    if (a === 203 && b === 0) return true;
    if (a >= 224) return true; // multicast, reserved, and limited broadcast
    return false;
  }
  if (isIPv6(ip)) {
    const words = ipv6Words(ip);
    if (!words) return true;
    const [w0, w1, w2, w3, w4, w5, w6, w7] = words;
    const embedded = `${w6 >>> 8}.${w6 & 0xff}.${w7 >>> 8}.${w7 & 0xff}`;
    const zeroPrefix = w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0;

    // ::/96 covers :: and ::1 and the deprecated IPv4-compatible form
    // (::127.0.0.1 or ::7f00:1); ::ffff:0:0/96 is IPv4-mapped. Both carry an
    // IPv4 address in the last 32 bits, so that address decides.
    if (zeroPrefix && w5 === 0) return w6 === 0 && w7 <= 1 ? true : isBlockedAddress(embedded);
    if (zeroPrefix && w5 === 0xffff) return isBlockedAddress(embedded);
    // ::ffff:0:0:0/96 is the IPv4-translated form used by stateless IP/ICMP
    // translation (::ffff:0:127.0.0.1 or ::ffff:0:7f00:1). A translator hands
    // it on to the embedded IPv4 address, so that address decides here too.
    if (w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0xffff && w5 === 0) return isBlockedAddress(embedded);
    // NAT64 (64:ff9b::/96) translates to the embedded IPv4 address; the local-use
    // NAT64 range (64:ff9b:1::/48) is internal by definition.
    if (w0 === 0x64 && w1 === 0xff9b && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0) return isBlockedAddress(embedded);
    if (w0 === 0x64 && w1 === 0xff9b && w2 === 1) return true;
    // 6to4 (2002::/16) carries an IPv4 address in bits 16-47.
    if (w0 === 0x2002) return isBlockedAddress(`${w1 >>> 8}.${w1 & 0xff}.${w2 >>> 8}.${w2 & 0xff}`);
    // Teredo (2001:0::/32) tunnels to an obfuscated IPv4 address; never a
    // legitimate image host, so it is refused outright.
    if (w0 === 0x2001 && w1 === 0) return true;
    if (w0 === 0x2001 && w1 === 0xdb8) return true; // documentation prefix
    if (w0 >= 0xfc00 && w0 <= 0xfdff) return true; // fc00::/7 unique-local
    if (w0 >= 0xfe80 && w0 <= 0xfebf) return true; // fe80::/10 link-local
    if (w0 >= 0xfec0 && w0 <= 0xfeff) return true; // fec0::/10 deprecated site-local
    if (w0 >= 0xff00) return true; // multicast
    return false;
  }
  return true; // unparseable — fail closed
}

/**
 * True when a URL hostname is itself an IP address in a blocked range.
 *
 * Node's http/https connect straight to an IP-literal host without calling a
 * custom DNS `lookup`, so a lookup-based guard never sees these. `URL` has
 * already normalised odd IPv4 spellings (2130706433, 0x7f.1) to dotted form;
 * IPv6 hostnames keep their brackets, which are stripped here.
 */
export function isBlockedIpLiteralHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (!isIPv4(host) && !isIPv6(host)) return false;
  return isBlockedAddress(host);
}

/**
 * The eight 16-bit words of an IPv6 address, with "::" expanded and a trailing
 * dotted IPv4 part converted. Null when it does not parse. Checking prefixes
 * as strings missed equivalent spellings (leading zeros, "::" in other places).
 */
function ipv6Words(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%", 1)[0];
  const dotted = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const bytes = dotted.slice(1).map(Number);
    if (bytes.some((byte) => byte > 255)) return null;
    text = `${text.slice(0, dotted.index)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":") : []);
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const words = all.map((word) => (/^[0-9a-f]{1,4}$/.test(word) ? Number.parseInt(word, 16) : Number.NaN));
  return words.length === 8 && words.every((word) => !Number.isNaN(word)) ? words : null;
}
