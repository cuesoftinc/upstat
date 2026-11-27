import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/controllers/service-map", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/service-map")
  >("@/controllers/service-map");
  return { ...actual, useServiceMapController: () => ctrl.current };
});

import ServiceMapPage from "./page";

function state(error: Error | null) {
  ctrl.current = {
    services: { data: null, loading: false, error, reload },
    nodes: [],
    edges: [],
  };
}

describe("ServiceMapPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the empty-map message", () => {
    state(new Error("boom"));
    render(<ServiceMapPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the service map.",
    );
    expect(screen.queryByText(/The map draws itself/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<ServiceMapPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to the service map.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
