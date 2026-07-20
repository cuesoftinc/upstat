import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Series } from "@/models";
import { ColorVisionProvider } from "@/design/ColorVisionProvider";
import { TimeseriesPanel } from "./TimeseriesPanel";

const SERIES: Series[] = [
  {
    name: "p95(http.request.duration_ms)",
    tags: { service: "web" },
    points: Array.from({ length: 20 }, (_, i) => ({
      ts: new Date(1752800000000 + i * 60000).toISOString(),
      value: 100 + i,
    })),
  },
];

describe("TimeseriesPanel", () => {
  it("renders the chart with legend toggle", async () => {
    render(
      <TimeseriesPanel title="p95 latency" query="| p95()" series={SERIES} />,
    );
    expect(
      screen.getByRole("img", { name: "p95 latency chart" }),
    ).toBeInTheDocument();
    const legend = screen.getByRole("button", { name: /p95\(/ });
    expect(legend).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(legend);
    expect(legend).toHaveAttribute("aria-pressed", "false");
  });

  it("shows axis-first loading and radar empty states (MI-16)", () => {
    const { container, rerender } = render(
      <TimeseriesPanel title="t" series={[]} loading />,
    );
    expect(container.querySelector('[data-kind="panel-axis"]')).not.toBeNull();
    rerender(<TimeseriesPanel title="t" series={[]} />);
    expect(screen.getByText("Waiting for data…")).toBeInTheDocument();
  });

  it("y axis: zero-based nice ticks with the unit suffix (master 50:407)", () => {
    render(<TimeseriesPanel title="t" series={SERIES} />);
    // values 100..119 → nice ladder 0 / 50 / 100 / 150; unit sniffed from
    // the `*_ms` metric name; the zero tick stays bare "0"
    for (const label of ["50 ms", "100 ms", "150 ms"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders bars and area modes", () => {
    const { container, rerender } = render(
      <TimeseriesPanel title="t" series={SERIES} mode="bars" />,
    );
    expect(container.querySelector('[data-mode="bars"]')).not.toBeNull();
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(10);
    rerender(<TimeseriesPanel title="t" series={SERIES} mode="area" />);
    expect(container.querySelector('[data-mode="area"]')).not.toBeNull();
  });

  it("legend shows the distinguishing tag part of grouped names (QA 2026-07-19)", () => {
    const grouped: Series[] = ["api-common", "web"].map((service) => ({
      name: `p95(http.request.duration_ms) service:${service}`,
      tags: { service },
      points: SERIES[0].points,
    }));
    render(<TimeseriesPanel title="t" series={grouped} />);
    // right-truncating the full names rendered N identical legend entries;
    // the discriminating tag VALUE is the label (master idiom, adjudicated
    // 2026-07-20 — the shared "service:" key prefix distinguishes nothing);
    // the full name is the tooltip
    const label = screen.getByText("api-common");
    expect(label).toBeInTheDocument();
    expect(label.closest("button")).toHaveAttribute(
      "title",
      "p95(http.request.duration_ms) service:api-common",
    );
    // ungrouped names still render in full
    render(<TimeseriesPanel title="u" series={SERIES} />);
    expect(
      screen.getByText("p95(http.request.duration_ms)"),
    ).toBeInTheDocument();
  });
});

describe("TimeseriesPanel — §5 colorblind mode (pattern fills / dashes)", () => {
  const TWO_SERIES: Series[] = [
    SERIES[0],
    { ...SERIES[0], name: "second", tags: { service: "api" } },
  ];

  beforeEach(() => {
    window.localStorage.clear();
  });

  const renderWithPatterns = (ui: React.ReactElement) => {
    window.localStorage.setItem("upstat.colorvision", "patterns");
    return render(<ColorVisionProvider>{ui}</ColorVisionProvider>);
  };

  it("line mode: non-first series strokes gain dash arrays", () => {
    const { container } = renderWithPatterns(
      <TimeseriesPanel title="t" series={TWO_SERIES} />,
    );
    const dashed = container.querySelectorAll("path[stroke-dasharray]");
    // series 0 stays solid (the baseline); series 1 is dashed
    expect(dashed.length).toBe(1);
  });

  it("bars mode: bars fill from hatch pattern defs", () => {
    const { container } = renderWithPatterns(
      <TimeseriesPanel title="t" series={SERIES} mode="bars" />,
    );
    expect(container.querySelector("defs pattern")).not.toBeNull();
    const bar = container.querySelector("svg g rect");
    expect(bar?.getAttribute("fill")).toMatch(/^url\(#/);
  });

  it("off by default — no dashes, no pattern defs", () => {
    const { container } = render(
      <TimeseriesPanel title="t" series={TWO_SERIES} mode="bars" />,
    );
    expect(container.querySelector("defs pattern")).toBeNull();
    expect(container.querySelector("path[stroke-dasharray]")).toBeNull();
  });
});
