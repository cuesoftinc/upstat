import { beforeEach, describe, expect, it } from "vitest";
import { FIRST_DATA_DELAY_MS } from "./seed";
import {
  activateOrg,
  allStores,
  createOrg,
  getDb,
  listOrgs,
  resetDb,
  telemetryReady,
} from "./store";

const NOW = Date.parse("2026-07-18T12:00:00Z");

describe("multi-org mock store (web-implementation.md §6)", () => {
  beforeEach(() => {
    resetDb(NOW);
  });

  it("seeds one primary org with the Figma narrative", () => {
    expect(listOrgs().map((o) => o.name)).toEqual(["Upstat"]);
    const db = getDb();
    expect(db.onboarding.has_data).toBe(true);
    expect(db.statusSlug).toBe("upstat");
    expect(db.incidents.some((i) => i.key === "INC-42")).toBe(true);
  });

  it("creates a fresh, EMPTY org and activates it without touching the seed", () => {
    const org = createOrg("Acme Staging", "Europe/Berlin");
    expect(listOrgs()).toHaveLength(2);

    const db = getDb();
    expect(db.org.id).toBe(org.id);
    expect(db.dashboards).toHaveLength(0);
    expect(db.monitors).toHaveLength(0);
    expect(db.incidents).toHaveLength(0);
    expect(db.onboarding.has_data).toBe(false);
    expect(db.onboarding.ingest_key).toMatch(/^uk_test_/);

    // the primary seed survives untouched
    const primary = allStores().find((s) => s.org.name === "Upstat")!;
    expect(primary.dashboards.length).toBeGreaterThan(0);
  });

  it("resolves waiting-for-data on the AFTER_TIMEOUT timer", () => {
    createOrg("Acme Staging", "UTC");
    const db = getDb();
    expect(telemetryReady(db, Date.now())).toBe(false);
    expect(telemetryReady(db, Date.now() + FIRST_DATA_DELAY_MS + 1)).toBe(true);
    // …and the metrics catalog starts populating with the first datapoint
    expect(db.metricCatalog.length).toBeGreaterThan(0);
  });

  it("switches back to the primary org with its narrative intact", () => {
    const primaryId = getDb().org.id;
    createOrg("Acme Staging", "UTC");
    expect(getDb().org.name).toBe("Acme Staging");
    expect(activateOrg(primaryId)).toBe(true);
    expect(getDb().org.name).toBe("Upstat");
    expect(getDb().onboarding.has_data).toBe(true);
    expect(activateOrg("org_missing")).toBe(false);
  });
});
