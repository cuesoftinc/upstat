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
  return { ...actual, useLogPatternsController: () => ctrl.current };
});

import { PatternsPanel } from "./PatternsPanel";

function state(error: Error | null) {
  ctrl.current = { data: null, loading: false, error, reload };
}

describe("PatternsPanel load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not a skeleton", () => {
    state(new Error("boom"));
    render(<PatternsPanel activeQuery="" live={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load log patterns.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<PatternsPanel activeQuery="" live={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to log patterns.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
