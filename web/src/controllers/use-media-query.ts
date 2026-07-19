"use client";

import { useSyncExternalStore } from "react";

/**
 * useMediaQuery — SSR-safe viewport query (design.md §2 breakpoints).
 * Server snapshot is `false` (desktop-first markup renders; the client
 * corrects after hydration — the NavRail default-width pattern).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
