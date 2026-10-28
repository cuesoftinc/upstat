# Flow: Authentication (Google-only, API session)

> Implements decision X-1 as hardened 2026-07-16: **Google sign-in only**,
> no username/password, product-wide. There is no `/signup`; `/signin` is
> the single auth screen (the old `/login` stub is removed; stale links 404
> on the branded page; user decision 2026-07-19).

## 1. Hard rule & enforcement

The API owns Google sign-in. `GET /v1/auth/sso/google?cv=<challenge>`
starts the redirect with a PKCE challenge and a state cookie; the callback
checks state, exchanges the Google code, links or creates the user by
Google-verified email, and redirects to the web app's
`/auth/callback?handoff=<code>`. The web posts the code and its PKCE
verifier to `POST /v1/auth/sso/exchange`, which sets the session cookie.
`return_to` must match an allowed origin exactly (`CORS_ORIGINS`).

`UserService/CreateUser` is closed (`FAILED_PRECONDITION sign up with
Google`), so no account can be created, or an email pre-claimed, outside
Google sign-in. SSO starts are capped per source; IPv6 sources are counted
per /64.

## 2. Session & boundaries

The session is an HttpOnly cookie carrying the API-signed JWT;
`GET /v1/auth/me` reads it and `POST /v1/auth/logout` clears it. Authed
HTTP routes read the cookie (or `Authorization: Bearer <token>`), and the
session middleware verifies it.

**Session restore [Decided 2026-07-22, platform-neutral]**: restore
resolves **before either surface routes**: the web reads `/v1/auth/me`
before dashboard routes render (the `DashboardShell` gate), and the mobile
on-call companion, when its phase opens, runs the same silent restore
behind its boot gate. A failed restore reads as **signed out** (never an
error interstitial); a signed-in user never sees the auth screen
(`/signin` carries the reverse guard).

Boundary inventory:

| Caller | Mechanism |
| --- | --- |
| Browser (HTTP surfaces) | API session cookie or bearer JWT |
| api/observability → api/common | optional Bearer session token (`API_TOKEN`) on authed routes |
| Tracking beacons | property public key (U-2) |
| Public `GET /v1/status/{ownerId}` and `GET /v1/monitors/{id}/checks` | unauthenticated allowlist |

## 3. Migration & failure paths

Link-by-email on first Google sign-in (Google emails are verified), with
the stranded-user support path. The password sign-in exists
only for the migration window: the **60-day window starts at the release
tag that ships Google sign-in** (recorded in decisions.md when cut); after
it, password sign-in is removed and the password fields are dropped.

Failure paths: a Google outage fails sign-ins closed; existing sessions
survive until the JWT expires. Email collision (a legacy row's email now
owned by a different Google account): first sign-in wins the link; the
other routes to support, the same policy as the stranded path.

## 4. Instrumentation & acceptance

Events (dogfooded once the events layer lands): `auth_signin_completed`,
`auth_migration_completed`.

- [x] Google sign-in end-to-end through the API handoff and session cookie
- [x] `CreateUser` closed; accounts come only from Google sign-in
- [ ] `/signup` removed; legacy password sign-in removed after the 60-day
  window
- [ ] Service tokens + property keys + public allowlist untouched
