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
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    const firstHextet = Number.parseInt(low.split(":", 1)[0] || "0", 16);
    if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true; // fe80::/10 link-local
    if (firstHextet >= 0xff00 && firstHextet <= 0xffff) return true; // multicast
    if (low.startsWith("2001:db8:")) return true; // documentation prefix

    // IPv4-mapped IPv6 can be emitted in dotted or hexadecimal form. Checking
    // only ::ffff:127.0.0.1 misses the canonical ::ffff:7f00:1 spelling.
    const dotted = low.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isBlockedAddress(dotted[1]);
    const mappedHex = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16);
      const lowWord = Number.parseInt(mappedHex[2], 16);
      return isBlockedAddress(
        `${high >>> 8}.${high & 0xff}.${lowWord >>> 8}.${lowWord & 0xff}`,
      );
    }
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
