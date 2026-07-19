import { ApiError, type ApiErrorBody } from "../errors";

/**
 * HTTP client for the repository layer — the ONLY place the app talks to the
 * network (web-standard MVC rule).
 *
 * TEST_MODE (`NEXT_PUBLIC_TEST_MODE=1`) targets the in-app mock server at
 * `/api/mock`; otherwise the real API base from `NEXT_PUBLIC_API_BASE`
 * (api.upstat.cuesoft.io once the HTTP surfaces land).
 */
export const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === "1";

export function apiBase(): string {
  if (TEST_MODE) return "/api/mock";
  return process.env.NEXT_PUBLIC_API_BASE || "/api/mock";
}

async function parseError(res: Response): Promise<never> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // non-envelope failure (proxy, network edge) — synthesize a stable code
  }
  throw new ApiError(
    res.status,
    body?.error ?? { code: "internal", message: `HTTP ${res.status}` },
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  delete<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};

/** Build a query string from defined params only. */
export function qs(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
