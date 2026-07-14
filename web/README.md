# Upstat Web (`web`)

Next.js 16 (App Router, TypeScript, styled-components) front-end: marketing
home at `/`, product dashboard at `/dashboard` (stats, uptime, traffic, SEO),
Google sign-in at `/login` via gRPC-Web (Envoy).

## Run

From the repo root (recommended): `make up` → http://localhost:3000

Dev server:

```bash
npm install
npm run dev
```

`NEXT_PUBLIC_*` values (API base, Envoy URL, Google client id) are inlined at
build time — set them in the root `.env` (see `.env.example`). Node version:
see `.nvmrc`.
