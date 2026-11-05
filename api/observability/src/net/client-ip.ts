import { isIP } from "node:net";
import type { Request } from "express";

let trusted = false;
let hops = 1;

/** Set once at startup from TRUST_PROXY_HEADERS and TRUST_PROXY_HOPS. */
export const setTrustProxy = (on: boolean, proxies = 1): void => {
  trusted = on;
  hops = Math.max(1, proxies);
};

/** The socket peer as a bare address (no port, no ::ffff: prefix). */
export const peerAddress = (peer: string): string =>
  peer
    .replace(/^ipv[46]:/, "")
    .replace(/^\[([^\]]+)\](:\d+)?$/, "$1")
    .replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1")
    .replace(/^::ffff:/, "");

/**
 * The client's address (analytics-math.md §1). Each trusted proxy appends
 * the address it saw to X-Forwarded-For, so the client is the entry
 * `hops` from the right (Cloud Run: 1, the Google front end; behind an
 * external load balancer: 2). Anything further left is client-supplied
 * and never read. Without trust, or when that entry is absent or not an
 * address, the socket peer. Used for limits and the visitor hash only,
 * never stored or logged.
 */
export const resolveClientIp = (
  forwardedFor: string | undefined,
  peer: string,
): string => {
  if (trusted && forwardedFor) {
    const chain = forwardedFor
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const candidate = chain[chain.length - hops];
    if (candidate && isIP(candidate)) return candidate;
  }
  return peerAddress(peer);
};

export const clientIp = (req: Request): string =>
  resolveClientIp(
    req.headers["x-forwarded-for"] as string | undefined,
    req.socket.remoteAddress ?? "",
  );
