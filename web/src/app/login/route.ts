import { NextResponse } from "next/server";

/**
 * /login → /signin — permanent redirect. The route standard makes /signin
 * the ONLY auth route (canonical across products); old links and bookmarks
 * must not 404.
 */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/signin", request.url), 308);
}
