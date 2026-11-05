/**
 * /api/v1/* proxy (system-design.md §6.5): the browser talks only to the
 * web origin, and this route handler forwards each path to its service —
 * the telemetry reads (/v1/query, /v1/logs*, /v1/traces*, /v1/services,
 * /v1/metrics*, /v1/rum*, /v1/usage, /v1/stats) to api/query, everything
 * else to api/common. Origins are read per request (API_URL, QUERY_URL), so
 * one build runs in compose and cloud. Use it by setting
 * NEXT_PUBLIC_API_URL=/api.
 *
 * Server-side code, not a view: no auth logic here. The session cookie,
 * bearer token and origin pass through untouched and the services check
 * them; Google sign-in's redirects and cookies pass back the same way.
 */

import { serverEnv } from "@/config/env";

export const dynamic = "force-dynamic";

const QUERY_ROOTS = new Set([
  "query",
  "logs",
  "traces",
  "services",
  "metrics",
  "rum",
  "usage",
  "stats",
]);

/** Request headers the backend contract uses (engineering.md, CORS). */
const FORWARD_REQUEST = [
  "authorization",
  "content-type",
  "idempotency-key",
  "x-org-id",
  "x-request-id",
  "cookie",
  "origin",
  "accept",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "x-forwarded-for",
];
/** Response headers the client reads. */
const FORWARD_RESPONSE = [
  "content-type",
  "retry-after",
  "x-request-id",
  "location",
  "cache-control",
];

/** Which service serves a /v1 path. */
export const targetFor = (path: string[]): "query" | "common" =>
  QUERY_ROOTS.has(path[0] ?? "") ? "query" : "common";

const backendUnavailable = () =>
  Response.json(
    {
      error: {
        code: "backend_unavailable",
        message: "The Upstat API is not reachable",
        details: {},
      },
    },
    { status: 502 },
  );

const proxy = async (
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await params;
  const { apiOrigin, queryOrigin } = serverEnv();
  const origin = targetFor(path) === "query" ? queryOrigin : apiOrigin;
  if (!origin) return backendUnavailable();
  const incoming = new URL(request.url);
  const target = `${origin}/v1/${path.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      cache: "no-store",
      redirect: "manual",
    } as RequestInit);
  } catch {
    return backendUnavailable();
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
