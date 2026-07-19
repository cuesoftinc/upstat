import { describe, expect, it } from "vitest";
import type { Dashboard } from "@/models";
import { dashboardToPortableJson, parsePortableDashboard } from "./dashboards";

const DASHBOARD: Dashboard = {
  id: "dash_x",
  org_id: "org_upstat",
  name: "Service overview",
  favorite: true,
  shared: true,
  template_vars: { env: ["prod", "staging"] },
  updated_at: "2026-07-19T00:00:00Z",
  widgets: [
    {
      id: "wid_1",
      dashboard_id: "dash_x",
      type: "timeseries",
      title: "p95 latency",
      query: null,
      query_string: "metric:http.request.duration_ms | p95()",
      viz_options: { display: "line" },
      layout: { x: 0, y: 0, w: 8, h: 3 },
    },
  ],
};

describe("portable dashboard JSON (pages.md B2; api.md §6)", () => {
  it("round-trips export → parse with ids stripped", () => {
    const text = dashboardToPortableJson(DASHBOARD);
    expect(text).not.toContain("dash_x");
    expect(text).not.toContain("wid_1");
    const parsed = parsePortableDashboard(text);
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe("Service overview");
    expect(parsed.template_vars).toEqual({ env: ["prod", "staging"] });
    expect(parsed.widgets).toHaveLength(1);
    expect(parsed.widgets[0]).toMatchObject({
      type: "timeseries",
      title: "p95 latency",
      layout: { x: 0, y: 0, w: 8, h: 3 },
    });
  });

  it("rejects malformed input with readable messages", () => {
    expect(() => parsePortableDashboard("nope")).toThrow(/not valid JSON/);
    expect(() => parsePortableDashboard('{"version":2,"name":"x","widgets":[]}')).toThrow(
      /unsupported version/,
    );
    expect(() => parsePortableDashboard('{"version":1,"widgets":[]}')).toThrow(/name/);
    expect(() => parsePortableDashboard('{"version":1,"name":"x"}')).toThrow(/widgets/);
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","widgets":[{"type":"nonsense","layout":{"x":0,"y":0,"w":1,"h":1}}]}',
      ),
    ).toThrow(/unknown widget type/);
    expect(() =>
      parsePortableDashboard('{"version":1,"name":"x","widgets":[{"type":"timeseries"}]}'),
    ).toThrow(/layout/);
  });

  it("rejects malformed template_vars and off-grid layouts (PR #168 review)", () => {
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","template_vars":{"env":"prod"},"widgets":[]}',
      ),
    ).toThrow(/template_vars/);
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","template_vars":{"env":[1]},"widgets":[]}',
      ),
    ).toThrow(/template_vars/);
    for (const layout of [
      '{"x":12,"y":0,"w":1,"h":3}', // x beyond the grid
      '{"x":8,"y":0,"w":6,"h":3}', // x+w > 12
      '{"x":0.5,"y":0,"w":4,"h":3}', // fractional
      '{"x":-1,"y":0,"w":4,"h":3}', // negative
      '{"x":0,"y":0,"w":0,"h":3}', // zero width
      '{"x":0,"y":0,"w":4,"h":0}', // zero height
    ]) {
      expect(() =>
        parsePortableDashboard(
          `{"version":1,"name":"x","widgets":[{"type":"timeseries","layout":${layout}}]}`,
        ),
      ).toThrow(/12-column grid/);
    }
  });

  it("rejects non-string display fields (PR #168 review round 2)", () => {
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","widgets":[{"type":"timeseries","title":{},"layout":{"x":0,"y":0,"w":4,"h":3}}]}',
      ),
    ).toThrow(/title must be a string/);
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","widgets":[{"type":"timeseries","query_string":42,"layout":{"x":0,"y":0,"w":4,"h":3}}]}',
      ),
    ).toThrow(/query_string must be a string/);
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","widgets":[{"type":"timeseries","viz_options":[],"layout":{"x":0,"y":0,"w":4,"h":3}}]}',
      ),
    ).toThrow(/viz_options must be an object/);
  });

  it("rejects non-string markdown text (PR 168 review round 3)", () => {
    expect(() =>
      parsePortableDashboard(
        '{"version":1,"name":"x","widgets":[{"type":"markdown","viz_options":{"text":{}},"layout":{"x":0,"y":0,"w":4,"h":2}}]}',
      ),
    ).toThrow(/markdown viz_options.text must be a string/);
  });

  it("defaults optional fields on import", () => {
    const parsed = parsePortableDashboard(
      '{"version":1,"name":"minimal","widgets":[{"type":"markdown","layout":{"x":0,"y":0,"w":4,"h":2}}]}',
    );
    expect(parsed.template_vars).toEqual({});
    expect(parsed.widgets[0].title).toBe("markdown");
    expect(parsed.widgets[0].viz_options).toEqual({});
  });
});
