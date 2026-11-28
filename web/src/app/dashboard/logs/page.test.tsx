import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/logs", async () => {
  const actual =
    await vi.importActual<typeof import("@/controllers/logs")>(
      "@/controllers/logs",
    );
  return {
    ...actual,
    useLogsExplorerController: () => ctrl.current,
    useLogLineKeys: () => {},
  };
});
// the histogram draws with browser features jsdom lacks; the test only reads our messages
vi.mock("@/components/ui/LogHistogram", () => ({ LogHistogram: () => null }));

import LogsPage from "./page";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function state(error: Error | null) {
  ctrl.current = {
    base: { data: null, loading: false, error, reload },
    views: { data: [], loading: false, error: null, reload: vi.fn() },
    events: [],
    live: false,
    paused: false,
    bufferedCount: 0,
    queryState: { pills: [], text: "", setText: vi.fn() },
    removePill: vi.fn(),
    submit: vi.fn(),
    selectedFacets: {},
    toggleFacet: vi.fn(),
    applyView: vi.fn(),
    pivot: vi.fn(),
    activeQuery: "",
    pause: vi.fn(),
    resume: vi.fn(),
  };
}

describe("LogsPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("shows the error state with a working retry, not the setup screen", () => {
    state(new Error("boom"));
    render(<LogsPage />);
    expect(screen.getByText("Couldn't load logs.")).toBeInTheDocument();
    expect(screen.queryByText(/upstat.js/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<LogsPage />);
    expect(
      screen.getByText("You don't have access to logs."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
