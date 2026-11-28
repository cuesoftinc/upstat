import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/status", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/status")>(
    "@/controllers/status",
  );
  return { ...actual, useStatusPageBuilderController: () => ctrl.current };
});
// the page reads the monitors list only to fill the component dropdowns
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

import StatusPageBuilderPage from "./page";

function state(error: Error | null) {
  ctrl.current = {
    config: { data: null, loading: false, error, reload },
    save: vi.fn(),
  };
}

describe("StatusPageBuilderPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not a skeleton", () => {
    state(new Error("boom"));
    render(<StatusPageBuilderPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the status page.",
    );
    expect(screen.queryByText(/Status page — builder/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<StatusPageBuilderPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to the status page.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
