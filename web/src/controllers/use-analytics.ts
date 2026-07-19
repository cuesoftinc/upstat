"use client";

/**
 * Analytics controller — the ecosystem canon name (`use-analytics.ts`,
 * same module in apparule/expendit): the hook-shaped controller surface
 * over the models-layer tracker. Upstat's transport is the real
 * `POST /v1/events` client (models/analytics.ts) — the models seam stays
 * the only network layer; this module owns the controller ergonomics.
 */

import { useEffect } from "react";
import {
  analytics,
  type EventDims,
  type UpstatEvent,
} from "@/models/analytics";

/** Fire a registered event (api.md §3.4 registry names; never throws). */
export function track(name: UpstatEvent, dims?: EventDims): void {
  analytics.track(name, dims);
}

/** page_view on mount (per path — re-fires on client-side navigation). */
export function usePageView(path: string): void {
  useEffect(() => {
    analytics.track("page_view", { path });
  }, [path]);
}
