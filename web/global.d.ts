// Committed stand-in for the gitignored `next-env.d.ts` so `tsc --noEmit`
// passes on fresh checkouts (CI runs typecheck before any `next` command
// generates next-env.d.ts): Next's ambient types + static-asset module
// declarations (*.png, *.svg, …). Harmlessly duplicates next-env.d.ts when
// both are present locally.
/// <reference types="next" />
/// <reference types="next/image-types/global" />
