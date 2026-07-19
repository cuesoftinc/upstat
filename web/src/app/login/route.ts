/**
 * /login → /signin — permanent redirect. The route standard makes /signin
 * the ONLY auth route (canonical across products); old links and bookmarks
 * must not 404.
 *
 * Host-independent on purpose: behind Firebase App Hosting the request URL
 * is the proxy-internal origin (https://0.0.0.0:8080), so building an
 * absolute Location from `request.url` (the old NextResponse.redirect
 * approach) sent browsers to 0.0.0.0. A relative Location (RFC 9110 §10.2.2)
 * lets the client resolve against whatever host it actually used.
 */
export function GET() {
  return new Response(null, {
    status: 308,
    headers: { Location: "/signin" },
  });
}
