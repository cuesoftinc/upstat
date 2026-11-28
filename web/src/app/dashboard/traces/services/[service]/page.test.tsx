import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reloadTraces, reloadLatency, h } = vi.hoisted(() => ({
  reloadTraces: vi.fn(),
  reloadLatency: vi.fn(),
  h: {
    services: { current: {} as Record<string, unknown> },
    traces: { current: {} as Record<string, unknown> },
    latency: { current: {} as Record<string, unknown> },
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ service: "checkout" }),
}));
vi.mock("@/controllers/telemetry", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/telemetry")
  >("@/controllers/telemetry");
  return {
    ...actual,
    useServicesController: () => h.services.current,
    useTracesController: () => h.traces.current,
    useQueryController: () => h.latency.current,
  };
});
vi.mock("@/controllers/time-range", () => ({
  useTimeRange: () => ({
    fromIso: "2026-01-01T00:00:00.000Z",
    toIso: "2026-01-01T01:00:00.000Z",
    zoomBy: vi.fn(),
    resetZoom: vi.fn(),
  }),
}));
// drawn charts need browser features jsdom lacks; the test only reads our messages
vi.mock("@/components/ui/TimeseriesPanel", () => ({
  TimeseriesPanel: () => null,
}));
vi.mock("@/components/ui/Heatmap", () => ({ Heatmap: () => null }));

import ServiceDetailPage from "./page";

const ok = () => ({ data: [], loading: false, error: null, reload: vi.fn() });
const failed = (error: Error, reload: () => void) => ({
  data: null,
  loading: false,
  error,
  reload,
});

function setup(overrides: {
  traces?: Record<string, unknown>;
  latency?: Record<string, unknown>;
}) {
  h.services.current = ok();
  h.traces.current = overrides.traces ?? ok();
  h.latency.current = overrides.latency ?? {
    data: null,
    loading: false,
    error: null,
    reload: vi.fn(),
  };
}

describe("ServiceDetailPage load failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("endpoints: shows the error state, not 'No traced endpoints'", () => {
    setup({ traces: failed(new Error("boom"), reloadTraces) });
    render(<ServiceDetailPage />);
    expect(screen.getByText("Couldn't load endpoints.")).toBeInTheDocument();
    expect(
      screen.queryByText("No traced endpoints in this range."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadTraces).toHaveBeenCalledTimes(1);
  });

  it("endpoints: shows the no-access state on a 403", () => {
    setup({
      traces: failed(
        new ApiError(403, { code: "forbidden", message: "forbidden" }),
        reloadTraces,
      ),
    });
    render(<ServiceDetailPage />);
    expect(
      screen.getByText("You don't have access to endpoints."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("latency: shows the error state with a working retry", () => {
    setup({ latency: failed(new Error("boom"), reloadLatency) });
    render(<ServiceDetailPage />);
    expect(screen.getByText("Couldn't load latency data.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadLatency).toHaveBeenCalledTimes(1);
  });
});
