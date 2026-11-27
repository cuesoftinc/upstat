import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/slos", async () => {
  const actual =
    await vi.importActual<typeof import("@/controllers/slos")>(
      "@/controllers/slos",
    );
  return { ...actual, useSlosController: () => ctrl.current };
});
// the page only reads the monitors list to fill the SLI source dropdown
vi.mock("@/controllers/monitors", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/monitors")>(
    "@/controllers/monitors",
  );
  return {
    ...actual,
    useMonitorsController: () => ({
      data: [],
      loading: false,
      error: null,
      reload: vi.fn(),
    }),
  };
});

import SlosPage from "./page";

function state(error: Error | null) {
  ctrl.current = {
    data: null,
    loading: false,
    error,
    reload,
    create: vi.fn(),
  };
}

describe("SlosPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the empty state", () => {
    state(new Error("boom"));
    render(<SlosPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load SLOs.");
    expect(screen.queryByText(/No SLOs yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<SlosPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to SLOs.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
