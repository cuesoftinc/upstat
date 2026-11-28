import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reloadSummary, reloadVitals, reloadErrors, ctrl } = vi.hoisted(() => ({
  reloadSummary: vi.fn(),
  reloadVitals: vi.fn(),
  reloadErrors: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/controllers/rum", async () => {
  const actual =
    await vi.importActual<typeof import("@/controllers/rum")>(
      "@/controllers/rum",
    );
  return { ...actual, useRumController: () => ctrl.current };
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

import RumPage from "./page";

const SUMMARY = {
  page_views: 10,
  uniques_daily_avg: 5,
  bounce_rate: null,
  series: [],
  top_pages: [],
  top_referrers: [],
  devices: [],
  countries: [],
};
const VITALS = {
  series: [],
  lcp_ms: { p75: 0 },
  cls: { p75: 0 },
  inp_ms: { p75: 0 },
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
    vitals: ok(VITALS, reloadVitals),
    errors: ok([], reloadErrors),
    properties: ok([], vi.fn()),
    ...overrides,
  };
}

describe("RumPage load failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summary: shows the error state, not the install-the-snippet screen", () => {
    setup({ summary: failed(new Error("boom"), reloadSummary) });
    render(<RumPage />);
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
    render(<RumPage />);
    expect(
      screen.getByText("You don't have access to RUM data."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("errors: shows the error state, not 'No JS errors captured'", () => {
    setup({ errors: failed(new Error("boom"), reloadErrors) });
    render(<RumPage />);
    expect(screen.getByText("Couldn't load error groups.")).toBeInTheDocument();
    expect(screen.queryByText(/No JS errors captured/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadErrors).toHaveBeenCalledTimes(1);
  });

  it("vitals: shows the error state with a working retry", () => {
    setup({ vitals: failed(new Error("boom"), reloadVitals) });
    render(<RumPage />);
    expect(screen.getByText("Couldn't load web vitals.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadVitals).toHaveBeenCalledTimes(1);
  });
});
