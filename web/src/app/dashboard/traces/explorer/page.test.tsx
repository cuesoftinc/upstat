import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, h } = vi.hoisted(() => ({
  reload: vi.fn(),
  h: {
    traces: { current: {} as Record<string, unknown> },
  },
}));
vi.mock("@/controllers/telemetry", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/telemetry")
  >("@/controllers/telemetry");
  return {
    ...actual,
    useTracesController: () => h.traces.current,
    useTraceController: () => ({
      data: null,
      loading: false,
      error: null,
      reload: vi.fn(),
    }),
    useTraceLogsController: () => ({
      data: [],
      loading: false,
      error: null,
      reload: vi.fn(),
    }),
  };
});
vi.mock("@/controllers/time-range", () => ({
  useTimeRange: () => ({
    fromIso: "2026-01-01T00:00:00.000Z",
    toIso: "2026-01-01T01:00:00.000Z",
  }),
}));

import TraceExplorerPage from "./page";

function state(error: Error | null) {
  h.traces.current = { data: null, loading: false, error, reload };
}

describe("TraceExplorerPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the setup message", () => {
    state(new Error("boom"));
    render(<TraceExplorerPage />);
    expect(screen.getByText("Couldn't load traces.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<TraceExplorerPage />);
    expect(
      screen.getByText("You don't have access to traces."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
