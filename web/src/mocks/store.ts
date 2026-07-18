import { buildSeed, type MockDb } from "./seed";

/**
 * In-memory mock store — module singleton kept on `globalThis` so it
 * survives Next dev HMR reloads (dev-persistent per the web standard).
 * Full CRUD lives in the route handlers; this owns identity + seeding.
 */
const GLOBAL_KEY = "__upstatMockDb" as const;

type GlobalWithDb = typeof globalThis & { [GLOBAL_KEY]?: MockDb };

export function getDb(): MockDb {
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = buildSeed(Date.now());
  }
  return g[GLOBAL_KEY];
}

/** Test hook — fresh narrative per test. */
export function resetDb(now = Date.now()): MockDb {
  const g = globalThis as GlobalWithDb;
  g[GLOBAL_KEY] = buildSeed(now);
  return g[GLOBAL_KEY];
}
