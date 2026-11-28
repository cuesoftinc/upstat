import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/telemetry", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/telemetry")
  >("@/controllers/telemetry");
  return { ...actual, useMetricsController: () => ctrl.current };
});

import MetricsSummaryPage from "./page";

function state(error: Error | null) {
  ctrl.current = { summary: { data: null, loading: false, error, reload } };
}

describe("MetricsSummaryPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the setup message", () => {
    state(new Error("boom"));
    render(<MetricsSummaryPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the metric catalog.",
    );
    expect(screen.queryByText(/No metrics yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<MetricsSummaryPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to the metric catalog.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
