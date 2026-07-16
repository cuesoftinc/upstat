# Flow: Authentication (Google-only, Firebase-backed)

> Implements decision X-1 as hardened 2026-07-16: **Google sign-in only** —
> no username/password, product-wide. Firebase Auth on `sandbox-e306a`.
> Replaces `UserService` credential flows (CreateUser with password,
> GetUser-with-password sign-in); `GoogleAuth` becomes *the* flow. `/signup`
> retires; `/login` is the single auth screen.

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

## 3. Migration

Link-by-email on first Google sign-in (Google emails pre-verified), same
shape as expendit flows/auth.md §3 including the 60-day window
(`FAILED_PRECONDITION migrate_to_firebase` after) and the stranded-user
support path. `CreateUser`/password fields deprecate out of `user.proto` at
the next proto rev.

## 4. Instrumentation & acceptance

Events (dogfooded once the events layer lands): `auth_signin_completed`,
`auth_migration_completed`.

- [ ] Google sign-in end-to-end through Envoy gRPC-Web metadata
- [ ] Interceptor rejects expired, foreign-project, and non-Google tokens
- [ ] `/signup` removed; cookies removed; legacy sign-in 410s after window
- [ ] Service tokens + property keys + public allowlist untouched
