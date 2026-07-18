import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Series } from "@/models";
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
    render(<TimeseriesPanel title="p95 latency" query="| p95()" series={SERIES} />);
    expect(screen.getByRole("img", { name: "p95 latency chart" })).toBeInTheDocument();
    const legend = screen.getByRole("button", { name: /p95\(/ });
    expect(legend).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(legend);
    expect(legend).toHaveAttribute("aria-pressed", "false");
  });

  it("shows axis-first loading and radar empty states (MI-16)", () => {
    const { container, rerender } = render(<TimeseriesPanel title="t" series={[]} loading />);
    expect(container.querySelector('[data-kind="panel-axis"]')).not.toBeNull();
    rerender(<TimeseriesPanel title="t" series={[]} />);
    expect(screen.getByText("Waiting for data…")).toBeInTheDocument();
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
});
