"use client";

import { notFound } from "next/navigation";
import { env } from "@/config/env";

// Test-only route: crashes on purpose so the e2e spec can prove the app-level
// error page (app/error.tsx) renders. Hidden from production builds unless
// TEST_MODE, same guard as /dev/components.
export default function DevCrashPage() {
  if (process.env.NODE_ENV === "production" && !env.testMode) {
    notFound();
  }
  // Throws in the browser only, so `next build` can still prerender the route.
  if (typeof window !== "undefined") {
    throw new Error("Intentional crash for the error-page e2e test");
  }
  return null;
}
