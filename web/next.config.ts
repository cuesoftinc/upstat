import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compiler: {
    // Enable the styled-components SWC transform (SSR class matching, display names).
    styledComponents: true,
  },
  // The dev indicator's default bottom-LEFT position sits exactly on the
  // expandable rail's foot toggle ([Directive 2026-07-19]) — it intercepts
  // pointer events over the collapsed-rail chevron (dev + e2e). Bottom-right
  // is empty app chrome.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
