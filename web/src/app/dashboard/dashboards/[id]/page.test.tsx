import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "dash_1" }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/controllers/dashboards", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/dashboards")
  >("@/controllers/dashboards");
  return { ...actual, useDashboardController: () => ctrl.current };
});
// hooks the page calls before its early return
vi.mock("@/controllers/time-range", () => ({
  useTimeRange: () => ({ zoomBy: vi.fn(), resetZoom: vi.fn() }),
}));
vi.mock("@/controllers/use-media-query", () => ({
  useMediaQuery: () => false,
}));

import DashboardViewPage from "./page";

function state(error: Error | null) {
  ctrl.current = {
    data: null,
    loading: false,
    error,
    reload,
    editMode: false,
    setEditMode: vi.fn(),
    savedPulse: false,
    moveWidget: vi.fn(),
    addWidget: vi.fn(),
    updateWidget: vi.fn(),
    duplicateWidget: vi.fn(),
    removeWidget: vi.fn(),
    pulseSaved: vi.fn(),
  };
}

describe("DashboardViewPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not a skeleton", () => {
    state(new Error("boom"));
    render(<DashboardViewPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load this dashboard.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<DashboardViewPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to this dashboard.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
