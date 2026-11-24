import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
]);

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.replace(/^\[|\]$/g, "").toLowerCase();

  if (cleaned === "::1" || cleaned === "::" || cleaned === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (cleaned.startsWith("::ffff:")) {
    const mappedV4 = cleaned.slice("::ffff:".length);
    if (net.isIPv4(mappedV4)) {
      return isPrivateOrReservedIp(mappedV4);
    }
  }

  if (net.isIPv6(cleaned)) {
    // Unique local (fc00::/7 -> fc.. or fd..) and link-local (fe80::/10)
    if (
      cleaned.startsWith("fc") ||
      cleaned.startsWith("fd") ||
      cleaned.startsWith("fe8") ||
      cleaned.startsWith("fe9") ||
      cleaned.startsWith("fea") ||
      cleaned.startsWith("feb")
    ) {
      return true;
    }
    return false;
  }

  if (net.isIPv4(cleaned)) {
    const parts = cleaned.split(".").map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      return true;
    }
    const [a, b] = parts;
    // 0.0.0.0/8 (current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (benchmark)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // Multicast & reserved >= 224
    if (a >= 224) return true;
    return false;
  }

  return true;
}

export async function validateSafePublicUrl(
  rawUrl: string,
  customResolver?: (hostname: string) => Promise<string[]>
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL format. Please provide a valid http:// or https:// website URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported URL protocol. Only http:// and https:// websites are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs containing embedded credentials are not permitted.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error("Blocked URL: Private, localhost, and internal network hosts are forbidden.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Blocked URL: Private, loopback, and link-local IP addresses are forbidden.");
    }
    return parsed;
  }

  const resolveFn =
    customResolver ??
    (async (host: string) => {
      const records = await dns.lookup(host, { all: true });
      return records.map((r) => r.address);
    });

  let addresses: string[];
  try {
    addresses = await resolveFn(hostname);
  } catch {
    throw new Error(`Unable to resolve domain hostname: ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`Domain ${hostname} did not resolve to any IP address.`);
  }

  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr)) {
      throw new Error(
        `Blocked URL: Hostname ${hostname} resolves to a private or reserved network address.`
      );
    }
  }

  return parsed;
}
