import type { Org } from "@/models";
import {
  buildEmptySeed,
  buildSeed,
  starterMetricCatalog,
  type MockDb,
} from "./seed";

/**
 * In-memory mock state — module singleton kept on `globalThis` so it
 * survives Next dev HMR reloads (dev-persistent per the web standard).
 *
 * W3 shape: one MockDb per org (web-implementation.md §6 — a second, empty
 * org walks the B1 first-run onboarding and the MI-16 empty states without
 * wiping the primary seed). `getDb()` returns the ACTIVE org's store, so
 * every handler stays org-scoped for free.
 */
const GLOBAL_KEY = "__upstatMockState" as const;

export interface MockState {
  activeOrgId: string;
  stores: Record<string, MockDb>;
}

type GlobalWithState = typeof globalThis & { [GLOBAL_KEY]?: MockState };

export function getState(): MockState {
  const g = globalThis as GlobalWithState;
  if (!g[GLOBAL_KEY]) {
    const primary = buildSeed(Date.now());
    g[GLOBAL_KEY] = {
      activeOrgId: primary.org.id,
      stores: { [primary.org.id]: primary },
    };
  }
  return g[GLOBAL_KEY];
}

/** The active org's store — the seeded narrative until the user switches. */
export function getDb(): MockDb {
  const state = getState();
  return state.stores[state.activeOrgId];
}

export function listOrgs(): Org[] {
  return Object.values(getState().stores).map((db) => db.org);
}

/** Switch the active org; false when the org does not exist. */
export function activateOrg(id: string): boolean {
  const state = getState();
  if (!state.stores[id]) return false;
  state.activeOrgId = id;
  return true;
}

/**
 * Create a fresh org with an EMPTY store and make it active — the B1
 * first-run path (create-org → send-your-first-data). The primary seed
 * stays untouched.
 */
export function createOrg(name: string, timezone: string): Org {
  const state = getState();
  const db = buildEmptySeed(Date.now(), name, timezone);
  state.stores[db.org.id] = db;
  state.activeOrgId = db.org.id;
  return db.org;
}

/** Every store, active or not (the public status page reads by slug). */
export function allStores(): MockDb[] {
  return Object.values(getState().stores);
}

/**
 * Resolve the waiting-for-data timer (AFTER_TIMEOUT convention) and report
 * whether telemetry flows for this org — the gate the telemetry endpoints
 * check before generating series (fresh orgs are empty until the mock's
 * first datapoint "arrives").
 */
export function telemetryReady(db: MockDb, now = Date.now()): boolean {
  if (
    !db.onboarding.has_data &&
    db.firstDataAtMs !== null &&
    now >= db.firstDataAtMs
  ) {
    db.onboarding.has_data = true;
    // first datapoint "arrived" — the metrics catalog starts populating
    if (db.metricCatalog.length === 0) {
      db.metricCatalog = starterMetricCatalog(now);
    }
  }
  return db.onboarding.has_data;
}

/** Test hook — fresh narrative per test. */
export function resetDb(now = Date.now()): MockDb {
  const g = globalThis as GlobalWithState;
  const primary = buildSeed(now);
  g[GLOBAL_KEY] = {
    activeOrgId: primary.org.id,
    stores: { [primary.org.id]: primary },
  };
  return primary;
}
