import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/controllers/incidents", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/incidents")
  >("@/controllers/incidents");
  return { ...actual, useIncidentsController: () => ctrl.current };
});

import IncidentsPage from "./page";

function state(error: Error | null) {
  ctrl.current = {
    data: null,
    loading: false,
    error,
    reload,
    declare: vi.fn(),
  };
}

describe("IncidentsPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the all-quiet message", () => {
    state(new Error("boom"));
    render(<IncidentsPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load incidents.",
    );
    expect(screen.queryByText(/may it stay that way/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<IncidentsPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to incidents.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
