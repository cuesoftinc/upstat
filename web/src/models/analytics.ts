/**
 * Dogfood analytics — the api.md §3.4 upstat registry row, instrumented
 * behind a TEST_MODE-safe interface (web-implementation.md W2 scope).
 *
 * Registry-first discipline (api.md §3.4a): every name here exists in the
 * §3.4 master registry BEFORE being instrumented — `page_view` plus the
 * W2-registered CTA events. Counters only, no free-form dims.
 *
 * Gating: events flow only when `NEXT_PUBLIC_ANALYTICS=1` (env-gated until
 * the Phase-1 events layer is live) and never in TEST_MODE — Playwright/CI
 * runs stay hermetic. Transport is the models-layer HTTP client
 * (`POST /v1/events`, api.md §3.1 batch shape).
 */

import { TEST_MODE, http } from "./repositories/client";

/** Registered upstat browser events (api.md §3.4). */
export type UpstatEvent =
  | "page_view"
  | "try_cloud_click"
  | "self_host_click"
  | "github_click";

/** §3.1 closed browser-dim vocabulary (client-suppliable subset). */
export interface EventDims {
  path?: string;
}

export interface AnalyticsTransport {
  (events: { name: UpstatEvent; dims?: EventDims }[]): Promise<unknown>;
}

export interface Tracker {
  track: (name: UpstatEvent, dims?: EventDims) => void;
  readonly enabled: boolean;
}

export function createTracker(options?: {
  enabled?: boolean;
  transport?: AnalyticsTransport;
}): Tracker {
  const enabled =
    options?.enabled ?? (!TEST_MODE && process.env.NEXT_PUBLIC_ANALYTICS === "1");
  const transport: AnalyticsTransport =
    options?.transport ?? ((events) => http.post("/v1/events", { events }));

  return {
    enabled,
    track(name, dims) {
      if (!enabled) return;
      // fire-and-forget — analytics must never break the page
      void transport([{ name, dims }]).catch(() => undefined);
    },
  };
}

/** The app-wide tracker (module singleton, like the repos). */
export const analytics = createTracker();
