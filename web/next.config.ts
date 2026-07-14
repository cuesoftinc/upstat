import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compiler: {
    // Enable the styled-components SWC transform (SSR class matching, display names).
    styledComponents: true,
  },
};

export default nextConfig;
