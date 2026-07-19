# Flow: Authentication (Google-only, Firebase-backed)

> Implements decision X-1 as hardened 2026-07-16: **Google sign-in only** —
> no username/password, product-wide. Firebase Auth on `sandbox-e306a`.
> `GoogleAuth` is *the* flow; the `UserService` credential RPCs (CreateUser
> with password, GetUser-with-password sign-in) exist only for the §3
> migration window. There is no `/signup`; `/signin` is the single auth
> screen (the old `/login` stub is removed — stale links 404 on the
> branded page; user decision 2026-07-19).

## 1. Hard rule & enforcement

Ecosystem standard (apparule flows/auth.md §1): Firebase provider config +
backend `sign_in_provider == google.com` check + single Google CTA. In gRPC
terms: the unary interceptor verifies Firebase ID tokens from metadata and
returns `PERMISSION_DENIED provider_not_allowed` for non-Google tokens.

## 2. Session & boundaries

Firebase SDK session; gRPC-Web carries `authorization: Bearer <ID token>`
metadata (interceptor swaps local-JWT verification for Firebase);
`upstat_token`/`upstat_user` cookies retire. Boundary inventory:

| Caller | Mechanism |
| --- | --- |
| Browser (gRPC-Web + new HTTP surfaces) | Firebase ID token (Google-provider-checked) |
| api/observability → api/common | `SERVICE_TOKEN` (unchanged — machine identity, not user auth) |
| Tracking beacons | property public key (U-2) |
| Public status/GetRecentChecks | unauthenticated allowlist (unchanged) |

## 3. Migration & failure paths

Link-by-email on first Google sign-in (Google emails pre-verified), same
shape as expendit flows/auth.md §3 including the stranded-user support path.
Precise semantics **[Decided]**: the **60-day window starts at the release
tag that ships Firebase auth** (recorded in decisions.md when cut); after it,
password sign-in returns `FAILED_PRECONDITION migrate_to_firebase`.
`CreateUser`/password fields deprecate out of `user.proto` at the next proto
rev; RPC fates per grpc-api.md's status banner (normative).

Failure paths: Firebase outage → sign-ins fail closed
(`UNAVAILABLE auth_upstream`); existing sessions survive until token expiry
(~1h). Token revocation (disabled user) → `PERMISSION_DENIED
account_disabled` on next verify. Clock skew absorbed by Firebase's ±5min
leeway. Email collision (legacy row's email now owned by a different Google
account): first-verifier wins the link; the loser routes to support — same
policy as the stranded path.

## 4. Instrumentation & acceptance

Events (dogfooded once the events layer lands): `auth_signin_completed`,
`auth_migration_completed`.

- [ ] Google sign-in end-to-end through Envoy gRPC-Web metadata
- [ ] Interceptor rejects expired, foreign-project, and non-Google tokens
- [ ] `/signup` removed; cookies removed; legacy sign-in 410s after window
- [ ] Service tokens + property keys + public allowlist untouched
