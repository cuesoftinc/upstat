import type { MetadataRoute } from "next";

/**
 * Web app manifest (App Router file convention — served at
 * /manifest.webmanifest and linked from every route's <head>).
 * Identity mirrors the root layout metadata; colors are the dark-primary
 * design tokens (tokens.css :root, design.md §2) — the manifest is static
 * server output, so the values are inlined rather than var()-bound.
 * Locked in e2e/seo.spec.ts (fleet-shared): 200 + product name + icons
 * resolve.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Upstat",
    short_name: "Upstat",
    description: "All your telemetry. One open platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1113", // --color-bg (dark canvas)
    theme_color: "#0e1113", // --color-bg — browser chrome matches the canvas
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32 48x48 256x256",
        type: "image/x-icon",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
