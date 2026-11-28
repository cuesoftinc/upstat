import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reloadCatalog, reloadDetail, ctrl } = vi.hoisted(() => ({
  reloadCatalog: vi.fn(),
  reloadDetail: vi.fn(),
  ctrl: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/catalog", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/catalog")>(
    "@/controllers/catalog",
  );
  return { ...actual, useCatalogPageController: () => ctrl.current };
});

import ServiceCatalogPage from "./page";

const SELECTED = {
  id: "svc_1",
  name: "checkout",
  environments: ["prod"],
  owner: "payments",
  links: {},
};

const failed = (error: Error, reload: () => void) => ({
  data: null,
  loading: false,
  error,
  reload,
});

function state(overrides: Record<string, unknown>) {
  ctrl.current = {
    catalog: { data: [], loading: false, error: null, reload: reloadCatalog },
    entries: [],
    search: "",
    setSearch: vi.fn(),
    selected: null,
    select: vi.fn(),
    detail: { data: null, loading: true, error: null, reload: reloadDetail },
    stats: null,
    ...overrides,
  };
}

describe("ServiceCatalogPage load failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry, not the empty message", () => {
    state({ catalog: failed(new Error("boom"), reloadCatalog) });
    render(<ServiceCatalogPage />);
    expect(
      screen.getByText("Couldn't load the service catalog."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No services registered yet/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadCatalog).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state({
      catalog: failed(
        new ApiError(403, { code: "forbidden", message: "forbidden" }),
        reloadCatalog,
      ),
    });
    render(<ServiceCatalogPage />);
    expect(
      screen.getByText("You don't have access to the service catalog."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("shows the detail error with a working retry when the stats fail", () => {
    state({
      selected: SELECTED,
      detail: failed(new Error("boom"), reloadDetail),
    });
    render(<ServiceCatalogPage />);
    expect(
      screen.getByText("Couldn't load this service's stats."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadDetail).toHaveBeenCalledTimes(1);
  });
});
