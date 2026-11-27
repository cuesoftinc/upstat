import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reload, ctrl } = vi.hoisted(() => ({
  reload: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/controllers/telemetry", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/telemetry")
  >("@/controllers/telemetry");
  return { ...actual, useServicesController: () => ctrl.current };
});

import ApmServicesPage from "./page";

function state(error: Error | null) {
  ctrl.current = { data: null, loading: false, error, reload };
}

describe("ApmServicesPage load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the no-services message", () => {
    state(new Error("boom"));
    render(<ApmServicesPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load services.",
    );
    expect(screen.queryByText(/No services yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state(new ApiError(403, { code: "forbidden", message: "forbidden" }));
    render(<ApmServicesPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to services.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
