import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Series } from "@/models";
import { Heatmap } from "./Heatmap";
import { LogHistogram } from "./LogHistogram";
import { TimeseriesPanel } from "./TimeseriesPanel";
import { UptimeCard } from "./UptimeCard";

/**
 * design.md §5: "All charts expose data-table toggle" — the shared
 * ChartTableToggle/ChartDataTable affordance across the bespoke charts.
 */

const SERIES: Series[] = [
  {
    name: "p95(http.request.duration_ms) service:web",
    tags: { service: "web" },
    points: Array.from({ length: 6 }, (_, i) => ({
      ts: new Date(1752800000000 + i * 60000).toISOString(),
      value: 100 + i,
    })),
  },
];

const toggle = () => screen.getByRole("button", { name: "View as table" });
const table = () => screen.queryByTestId("chart-data-table");

describe("chart data-table toggle (§5)", () => {
  it("TimeseriesPanel (chrome): toggles between plot and table", async () => {
    render(<TimeseriesPanel title="p95" series={SERIES} />);
    expect(table()).not.toBeInTheDocument();
    expect(screen.getByTestId("timeseries-plot")).toBeInTheDocument();

    await userEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("timeseries-plot")).not.toBeInTheDocument();
    // time column + a series column carrying the plotted values
    expect(
      screen.getByRole("columnheader", { name: "Time" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "service:web" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument();

    await userEvent.click(toggle());
    expect(table()).not.toBeInTheDocument();
    expect(screen.getByTestId("timeseries-plot")).toBeInTheDocument();
  });

  it("TimeseriesPanel (bare widget plot) still offers the affordance", async () => {
    render(<TimeseriesPanel title="p95" series={SERIES} chrome={false} />);
    await userEvent.click(toggle());
    expect(table()).toBeInTheDocument();
  });

  it("TimeseriesPanel hides the toggle in loading/empty states", () => {
    const { rerender } = render(
      <TimeseriesPanel title="t" series={[]} loading />,
    );
    expect(
      screen.queryByRole("button", { name: "View as table" }),
    ).not.toBeInTheDocument();
    rerender(<TimeseriesPanel title="t" series={[]} />);
    expect(
      screen.queryByRole("button", { name: "View as table" }),
    ).not.toBeInTheDocument();
  });

  it("Heatmap: table renders one row per time bucket, one column per value bucket", async () => {
    render(
      <Heatmap
        columns={["10:00", "10:05"]}
        rows={["≤50ms", "≤200ms"]}
        values={[
          [1, 2],
          [3, 4],
        ]}
      />,
    );
    await userEvent.click(toggle());
    expect(
      screen.getByRole("columnheader", { name: "≤200ms" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10:05" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "4" })).toBeInTheDocument();
  });

  it("LogHistogram: table carries per-level counts per bucket", async () => {
    render(
      <LogHistogram
        buckets={[
          {
            ts: "2026-07-20T10:00:00Z",
            counts: { INFO: 5, DEBUG: 1, TRACE: 0, WARN: 2, ERROR: 1 },
          },
        ]}
      />,
    );
    await userEvent.click(toggle());
    expect(
      screen.getByRole("columnheader", { name: "ERROR" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
  });

  it("UptimeCard: table lists days newest-first with uptime and downtime", async () => {
    render(
      <UptimeCard
        name="checkout"
        days={[
          { date: "2026-07-19", uptime_pct: 99.2, down_minutes: 11 },
          { date: "2026-07-20", uptime_pct: 100, down_minutes: 0 },
        ]}
        uptimePct={99.6}
      />,
    );
    await userEvent.click(toggle());
    const cells = screen.getAllByRole("cell");
    // newest day first
    expect(cells[0]).toHaveTextContent("2026-07-20");
    expect(screen.getByRole("cell", { name: "99.2%" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "11m" })).toBeInTheDocument();
  });
});
