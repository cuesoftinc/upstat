import { NextResponse } from "next/server";

/** Ecosystem error envelope (engineering.md §"envelope") — snake_case codes. */
export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function jsonOk<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body as unknown as Record<string, unknown>, { status });
}

export function notFound(what = "resource"): NextResponse {
  return jsonError(404, "not_found", `${what} not found`);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
