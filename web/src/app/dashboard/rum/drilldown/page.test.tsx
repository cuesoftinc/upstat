import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reloadSummary, reloadDrilldown, ctrl } = vi.hoisted(() => ({
  reloadSummary: vi.fn(),
  reloadDrilldown: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/controllers/rum", async () => {
  const actual =
    await vi.importActual<typeof import("@/controllers/rum")>(
      "@/controllers/rum",
    );
  return { ...actual, useRumDrilldownController: () => ctrl.current };
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

import RumDrilldownPage from "./page";

const SUMMARY = {
  page_views: 10,
  series: [],
  top_pages: [],
  top_referrers: [],
};

const ok = (data: unknown, reload: () => void) => ({
  data,
  loading: false,
  error: null,
  reload,
});
const failed = (error: Error, reload: () => void) => ({
  data: null,
  loading: false,
  error,
  reload,
});

function setup(overrides: Record<string, unknown>) {
  ctrl.current = {
    summary: ok(SUMMARY, reloadSummary),
    drilldown: failed(new Error("unused"), reloadDrilldown),
    properties: ok([], vi.fn()),
    ...overrides,
  };
}

describe("RumDrilldownPage load failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summary: shows the error state, not the install-the-snippet screen", () => {
    setup({ summary: failed(new Error("boom"), reloadSummary) });
    render(<RumDrilldownPage />);
    expect(screen.getByText("Couldn't load RUM data.")).toBeInTheDocument();
    expect(screen.queryByText(/upstat.js/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadSummary).toHaveBeenCalledTimes(1);
  });

  it("summary: shows the no-access state on a 403", () => {
    setup({
      summary: failed(
        new ApiError(403, { code: "forbidden", message: "forbidden" }),
        reloadSummary,
      ),
    });
    render(<RumDrilldownPage />);
    expect(
      screen.getByText("You don't have access to RUM data."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("drilldown: the funnel and the retention card both show the error", () => {
    setup({ drilldown: failed(new Error("boom"), reloadDrilldown) });
    render(<RumDrilldownPage />);
    expect(
      screen.getByText("Couldn't load the conversion funnel."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Couldn't load retention data."),
    ).toBeInTheDocument();
    const retries = screen.getAllByRole("button", { name: "Try again" });
    expect(retries).toHaveLength(2);
    fireEvent.click(retries[0]);
    expect(reloadDrilldown).toHaveBeenCalledTimes(1);
  });
});
