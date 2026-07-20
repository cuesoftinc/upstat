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

  it("publishes the pillar's latency figure, not its own (accuracy QA 2026-07-19)", () => {
    const db = buildSeed(NOW);
    const page = buildStatusPage(db, "upstat", NOW);
    for (const component of page.components) {
      const monitor = db.monitors.find((m) => m.name === component.name);
      // same source as /dashboard/uptime cards — the page hardcoded 96ms
      expect(component.p95_ms).toBe(monitor?.last_response_time_ms ?? null);
    }
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

describe("buildStatusPage — builder config reflection (B7 [Designed 2026-07-20])", () => {
  it("renders builder rows in order with builder names", () => {
    const db = buildSeed(NOW);
    db.statusPage = {
      name: "Upstat",
      slug: "upstat",
      components: [
        { id: "spc_1", name: "API", monitor_id: "mon_api" },
        { id: "spc_2", name: "Dashboard", monitor_id: "mon_homepage" },
      ],
    };
    const page = buildStatusPage(db, "upstat", NOW);
    expect(page.components.map((c) => c.name)).toEqual(["API", "Dashboard"]);
    // mapped monitor supplies status/strip/latency under the builder name
    const api = page.components[0];
    const monApi = db.monitors.find((m) => m.id === "mon_api")!;
    expect(api.status).toBe(monApi.status);
    expect(api.p95_ms).toBe(monApi.last_response_time_ms);
    expect(api.days).toHaveLength(90);
  });

  it("reorder in the builder reorders the public page", () => {
    const db = buildSeed(NOW);
    const [first, ...rest] = db.statusPage!.components;
    db.statusPage = {
      ...db.statusPage!,
      components: [...rest, first],
    };
    const page = buildStatusPage(db, "upstat", NOW);
    expect(page.components[page.components.length - 1].name).toBe(first.name);
  });

  it("the builder page name governs the public header", () => {
    const db = buildSeed(NOW);
    db.statusPage = { ...db.statusPage!, name: "Upstat Cloud" };
    expect(buildStatusPage(db, "upstat", NOW).org_name).toBe("Upstat Cloud");
  });

  it("unmapped rows publish as nodata, never crash", () => {
    const db = buildSeed(NOW);
    db.statusPage = {
      ...db.statusPage!,
      components: [{ id: "spc_x", name: "Ingestion", monitor_id: null }],
    };
    const page = buildStatusPage(db, "upstat", NOW);
    expect(page.components).toEqual([
      {
        name: "Ingestion",
        status: "nodata",
        days: [],
        uptime_pct: null,
        p95_ms: null,
      },
    ]);
  });
});
