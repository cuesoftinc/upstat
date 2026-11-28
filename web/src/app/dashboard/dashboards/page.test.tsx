import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/controllers/dashboards", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/dashboards")
  >("@/controllers/dashboards");
  return { ...actual, useDashboardsController: () => ctrl.current };
});

import DashboardsPage from "./page";

function state(error: Error | null) {
  ctrl.current = {
    data: null,
    loading: false,
    error,
    reload,
    create: vi.fn(),
    toggleFavorite: vi.fn(),
    importJson: vi.fn(),
  };
}

describe("DashboardsPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the empty state", () => {
    state(new Error("boom"));
    render(<DashboardsPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load dashboards.",
    );
    expect(screen.queryByText(/No dashboards yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<DashboardsPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to dashboards.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
