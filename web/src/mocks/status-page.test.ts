import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { buildStatusPage } from "./status-page";
import { iso } from "./util";

const NOW = Date.parse("2026-07-18T12:00:00Z");

describe("buildStatusPage (B7 public read)", () => {
  it("renders the seeded narrative: INC-42 monitoring → degraded", () => {
    const db = buildSeed(NOW);
    const page = buildStatusPage(db, "upstat", NOW);
    expect(page.slug).toBe("upstat");
    expect(page.org_name).toBe("Upstat");
    // open sev1 in MONITORING = mitigated, watching → degraded (not major)
    expect(page.overall).toBe("degraded");
    // paused/muted checks stay internal; active ones publish with strips
    expect(page.components.some((c) => c.name === "Legacy blog")).toBe(false);
    const homepage = page.components.find((c) => c.name === "Homepage");
    expect(homepage?.days).toHaveLength(90);
    expect(homepage?.uptime_pct).toBeGreaterThan(99);
  });

  it("reflects a freshly declared sev1 immediately (B9 linkage)", () => {
    const db = buildSeed(NOW);
    db.incidents.unshift({
      id: "inc_new",
      org_id: db.org.id,
      key: "INC-43",
      title: "Elevated error rate on /v1/events",
      sev: 1,
      status: "investigating",
      roles: { commander: "Kemi", responders: [] },
      started_at: iso(NOW),
      resolved_at: null,
      postmortem_key: null,
      services: [],
    });
    const page = buildStatusPage(db, "upstat", NOW);
    expect(page.overall).toBe("major_outage");
    // open incidents sort ahead of resolved history
    expect(page.incidents[0]?.key).toBe("INC-43");
  });

  it("goes operational when everything is resolved", () => {
    const db = buildSeed(NOW);
    for (const incident of db.incidents) {
      incident.status = "resolved";
      incident.resolved_at = iso(NOW);
    }
    const page = buildStatusPage(db, "upstat", NOW);
    expect(page.overall).toBe("operational");
  });

  it("orders timeline updates newest-first per incident", () => {
    const db = buildSeed(NOW);
    const page = buildStatusPage(db, "upstat", NOW);
    const inc42 = page.incidents.find((i) => i.key === "INC-42")!;
    const times = inc42.updates.map((u) => Date.parse(u.ts));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});
