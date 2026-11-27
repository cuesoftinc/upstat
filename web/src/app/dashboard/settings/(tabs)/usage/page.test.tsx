import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/settings", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/settings")>(
    "@/controllers/settings",
  );
  return { ...actual, useUsageController: () => ctrl.current };
});

import UsagePage from "./page";

function state(error: Error | null) {
  ctrl.current = { data: null, loading: false, error, reload };
}

describe("UsagePage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not a skeleton", () => {
    state(new Error("boom"));
    render(<UsagePage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load usage.");
    expect(screen.queryByText(/Month-to-date usage/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<UsagePage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to usage.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
