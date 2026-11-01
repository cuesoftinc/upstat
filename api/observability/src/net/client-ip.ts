import { isIP } from "node:net";
import type { Request } from "express";

const PRIVATE = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^f[cd]/i,
  /^fe80/i,
];

let trustProxy = false;

/** Set once at startup from TRUST_PROXY_HEADERS. */
export const setTrustProxy = (on: boolean): void => {
  trustProxy = on;
};

/**
 * The client's address (analytics-math.md §1): behind the load balancer,
 * the left-most public address in X-Forwarded-For; otherwise the socket.
 * Used for limits and the visitor hash only, never stored or logged.
 */
export const clientIp = (req: Request): string => {
  if (trustProxy) {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => isIP(s));
    const pub = forwarded.find((ip) => !PRIVATE.some((re) => re.test(ip)));
    if (pub) return pub;
  }
  return (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
};
