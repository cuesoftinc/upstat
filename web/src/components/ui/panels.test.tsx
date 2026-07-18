import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Series, Span, Trace } from "@/models";
import { EmptyState } from "./EmptyState";
import { Heatmap } from "./Heatmap";
import { LogHistogram } from "./LogHistogram";
import { QueryValue } from "./QueryValue";
import { ServiceMapNode } from "./ServiceMapNode";
import { SpanDrawer } from "./SpanDrawer";
import { SpanRow } from "./SpanRow";
import { Table } from "./Table";
import { ThresholdOverlay } from "./ThresholdOverlay";
import { TimeseriesPanel } from "./TimeseriesPanel";
import { TopList } from "./TopList";
import { TraceMinimap } from "./TraceMinimap";
import { TraceWaterfall } from "./TraceWaterfall";
import { WidgetShell } from "./WidgetShell";

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

const SPAN: Span = {
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
  span_id: "span_insert",
  parent_id: "span_root",
  service: "clickhouse",
  name: "clickhouse.insert",
  start: "2026-07-18T11:18:00.012Z",
  duration_ns: 22_400_000,
  status: "ok",
  attrs: { table: "events" },
};

const TRACE: Trace = {
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
  root_service: "api-common",
  root_name: "POST /v1/events",
  start: "2026-07-18T11:18:00.000Z",
  duration_ms: 48.2,
  span_count: 2,
  status: "ok",
  spans: [
    {
      trace_id: "9f86d081884c7d659a2feaa0c55ad015",
      span_id: "span_root",
      parent_id: null,
      service: "api-common",
      name: "POST /v1/events",
      start: "2026-07-18T11:18:00.000Z",
      duration_ns: 48_200_000,
      status: "ok",
      attrs: {},
    },
    SPAN,
  ],
};

describe("TimeseriesPanel", () => {
  it("renders the chart with legend toggle", async () => {
    render(<TimeseriesPanel title="p95 latency" query="| p95()" series={SERIES} />);
    expect(screen.getByRole("img", { name: "p95 latency chart" })).toBeInTheDocument();
    const legend = screen.getByRole("button", { name: /p95\(/ });
    expect(legend).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(legend);
    expect(legend).toHaveAttribute("aria-pressed", "false");
  });

  it("shows axis-first loading and radar empty states", () => {
    const { container, rerender } = render(
      <TimeseriesPanel title="t" series={[]} loading />,
    );
    expect(container.querySelector('[data-kind="panel-axis"]')).not.toBeNull();
    rerender(<TimeseriesPanel title="t" series={[]} />);
    expect(screen.getByText("Waiting for data…")).toBeInTheDocument();
  });
});

describe("WidgetShell", () => {
  it("opens the ⋯ menu and enters fullscreen; ESC exits (MI-12)", async () => {
    const onMode = vi.fn();
    const { rerender } = render(
      <WidgetShell title="Errors" mode="view" onModeChange={onMode}>
        chart
      </WidgetShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Widget menu for Errors" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Fullscreen" }));
    expect(onMode).toHaveBeenCalledWith("fullscreen");
    rerender(
      <WidgetShell title="Errors" mode="fullscreen" onModeChange={onMode}>
        chart
      </WidgetShell>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onMode).toHaveBeenCalledWith("view");
  });
});

describe("QueryValue", () => {
  it("shows the delta chip and threshold tint", () => {
    render(<QueryValue value="142 ms" deltaPct={-3.4} threshold="warn" />);
    expect(screen.getByText("142 ms")).toHaveClass("text-warn");
    expect(screen.getByText("-3.4%")).toBeInTheDocument();
  });
});

describe("TopList", () => {
  it("renders ranked bars and the empty state", () => {
    const { rerender } = render(
      <TopList entries={[{ label: "checkout", value: 42 }]} />,
    );
    expect(screen.getByText("checkout")).toBeInTheDocument();
    rerender(<TopList entries={[]} />);
    expect(screen.getByText("No data in range.")).toBeInTheDocument();
  });
});

describe("Table", () => {
  it("right-aligns numeric columns in mono", () => {
    render(
      <Table
        columns={[
          { key: "svc", label: "Service" },
          { key: "p95", label: "p95", numeric: true },
        ]}
        rows={[{ svc: "web", p95: 142 }]}
      />,
    );
    expect(screen.getByText("142")).toHaveClass("text-right", "font-data");
  });
});

describe("Heatmap", () => {
  it("renders the cell grid", () => {
    render(
      <Heatmap columns={["09:00", "09:05"]} rows={["<100ms", "<500ms"]} values={[[1, 4], [2, 0]]} />,
    );
    expect(screen.getByRole("img", { name: "heatmap" }).children).toHaveLength(4);
  });
});

describe("LogHistogram", () => {
  it("stacks level counts per bucket", () => {
    render(
      <LogHistogram
        buckets={[
          { ts: "2026-07-18T09:00:00Z", counts: { INFO: 10, DEBUG: 2, WARN: 1, ERROR: 5, TRACE: 0 } },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "log volume histogram" })).toBeInTheDocument();
    expect(screen.getByText("18 lines")).toBeInTheDocument();
  });
});

describe("ThresholdOverlay", () => {
  it("draws bands and would-have-fired markers (MI-9)", () => {
    const { container } = render(
      <ThresholdOverlay warnFrom={0.5} critFrom={0.8} markers={[0.3, 0.6]} />,
    );
    expect(container.querySelector('[data-band="warn"]')).not.toBeNull();
    expect(container.querySelector('[data-band="crit"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-marker]")).toHaveLength(2);
  });
});

describe("SpanRow", () => {
  it("selects and reports hover (MI-7)", async () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    render(
      <SpanRow span={SPAN} depth={1} colorIndex={2} offsetFrac={0.2} widthFrac={0.4} onSelect={onSelect} onHover={onHover} />,
    );
    await userEvent.hover(screen.getByRole("button"));
    expect(onHover).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("SpanDrawer", () => {
  it("switches tags / logs / process tabs", async () => {
    render(<SpanDrawer span={SPAN} onClose={() => undefined} />);
    expect(screen.getByText("table")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "process" }));
    expect(screen.getByText("span_insert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /logs/ }));
    expect(screen.getByText("No logs within this span.")).toBeInTheDocument();
  });
});

describe("TraceWaterfall", () => {
  it("renders span rows and opens the drawer on click", async () => {
    render(<TraceWaterfall trace={TRACE} />);
    const rows = screen.getAllByRole("button", { name: /clickhouse.insert|POST \/v1\/events/ });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getByRole("button", { name: /clickhouse.insert/ }));
    expect(screen.getByRole("tab", { name: "tags" })).toBeInTheDocument();
  });
});

describe("TraceMinimap", () => {
  it("renders one bar per span", () => {
    render(
      <TraceMinimap spans={TRACE.spans} durationMs={TRACE.duration_ms} startTs={TRACE.start} />,
    );
    expect(screen.getByRole("img", { name: "trace minimap" }).children).toHaveLength(2);
  });
});

describe("ServiceMapNode", () => {
  it("carries state + metrics in the accessible name", () => {
    render(<ServiceMapNode name="checkout" reqPerS={42.5} errorRate={0.12} selected />);
    expect(
      screen.getByRole("button", { name: "checkout: 42.5 req/s, 12.0% errors" }),
    ).toHaveAttribute("data-state", "selected");
  });
});

describe("EmptyState", () => {
  it("offers the copyable snippet + docs link (MI-16)", () => {
    render(<EmptyState pillar="rum" />);
    expect(screen.getByText(/upstat.js/)).toBeInTheDocument();
    expect(screen.getByLabelText("Copy snippet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Setup docs/ })).toBeInTheDocument();
  });

  it("stops the sweep when data arrives", () => {
    render(<EmptyState pillar="metrics" waiting={false} />);
    expect(screen.getByText("First datapoint received")).toBeInTheDocument();
  });
});
