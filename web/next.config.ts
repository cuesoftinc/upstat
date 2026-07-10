import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    compiler: {
    // This forces class names to match on both SSR and client hydration
    styledComponents: true,
  },
};

export default nextConfig;
