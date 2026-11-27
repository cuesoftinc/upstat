import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { rerun, reloadServices, h } = vi.hoisted(() => ({
  rerun: vi.fn(),
  reloadServices: vi.fn(),
  h: {
    explorer: { current: {} as Record<string, unknown> },
    services: { current: {} as Record<string, unknown> },
  },
}));
vi.mock("@/controllers/explorer", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/explorer")>(
    "@/controllers/explorer",
  );
  return { ...actual, useMetricsExplorerController: () => h.explorer.current };
});
vi.mock("@/controllers/telemetry", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/telemetry")
  >("@/controllers/telemetry");
  return {
    ...actual,
    useMetricsController: () => ({
      summary: { data: [], loading: false, error: null, reload: vi.fn() },
    }),
    useServicesController: () => h.services.current,
  };
});
vi.mock("@/controllers/dashboards", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/dashboards")
  >("@/controllers/dashboards");
  return {
    ...actual,
    useDashboardsController: () => ({
      data: [],
      loading: false,
      error: null,
      reload: vi.fn(),
    }),
  };
});
// drawn charts need browser features jsdom lacks; the test only reads our messages
vi.mock("@/components/ui/TimeseriesPanel", () => ({
  TimeseriesPanel: () => <div data-testid="chart" />,
}));

import MetricsExplorerPage from "./page";

function explorer(requestError: Error | null) {
  h.explorer.current = {
    queryState: {
      pills: [],
      text: "",
      setText: vi.fn(),
      removePill: vi.fn(),
    },
    result: null,
    running: false,
    syntaxError: null,
    requestError,
    rerun,
    activeQuery: "",
    submit: vi.fn(),
    pivot: vi.fn(),
    applyView: vi.fn(),
    saveToDashboard: vi.fn(),
    views: { data: [], loading: false, error: null, reload: vi.fn() },
    time: { zoomBy: vi.fn(), resetZoom: vi.fn() },
  };
}

function services(error: Error | null) {
  h.services.current = error
    ? { data: null, loading: false, error, reload: reloadServices }
    : { data: [], loading: false, error: null, reload: reloadServices };
}

describe("MetricsExplorerPage load failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chart: shows the error state with a working retry, not an empty chart", () => {
    explorer(new Error("boom"));
    services(null);
    render(<MetricsExplorerPage />);
    expect(
      screen.getByText("Couldn't load the metric query."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(rerun).toHaveBeenCalledTimes(1);
  });

  it("chart: shows the no-access state on a 403", () => {
    explorer(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    services(null);
    render(<MetricsExplorerPage />);
    expect(
      screen.getByText("You don't have access to the metric query."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("services: shows the error state with a working retry", () => {
    explorer(null);
    services(new Error("boom"));
    render(<MetricsExplorerPage />);
    expect(screen.getByText("Couldn't load services.")).toBeInTheDocument();
    expect(screen.getByTestId("chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadServices).toHaveBeenCalledTimes(1);
  });
});
