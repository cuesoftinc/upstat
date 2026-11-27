import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { reloadIncident, reloadTimeline, reloadPostmortem, ctrl } = vi.hoisted(
  () => ({
    reloadIncident: vi.fn(),
    reloadTimeline: vi.fn(),
    reloadPostmortem: vi.fn(),
    ctrl: { current: {} as Record<string, unknown> },
  }),
);
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "inc_1" }),
}));
vi.mock("@/controllers/incidents", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/incidents")
  >("@/controllers/incidents");
  return { ...actual, useIncidentController: () => ctrl.current };
});

import IncidentDetailPage from "./page";

const INCIDENT = {
  id: "inc_1",
  key: "INC-1",
  title: "Checkout latency",
  sev: 2,
  status: "investigating",
  roles: { commander: "Ada", responders: ["Bo"] },
};

const failed = (error: Error, reload: () => void) => ({
  data: null,
  loading: false,
  error,
  reload,
});

function state(overrides: Record<string, unknown>) {
  ctrl.current = {
    incident: {
      data: INCIDENT,
      loading: false,
      error: null,
      reload: reloadIncident,
    },
    timeline: {
      data: [],
      loading: false,
      error: null,
      reload: reloadTimeline,
    },
    entries: [],
    postUpdate: vi.fn(),
    posting: false,
    postError: null,
    // loading keeps PostmortemSection out of the way for the other cases
    postmortem: {
      data: null,
      loading: true,
      error: null,
      reload: reloadPostmortem,
    },
    savePostmortem: vi.fn(),
    savingPostmortem: false,
    postmortemError: null,
    ...overrides,
  };
}

describe("IncidentDetailPage load failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry when the incident fails", () => {
    state({ incident: failed(new Error("boom"), reloadIncident) });
    render(<IncidentDetailPage />);
    expect(
      screen.getByText("Couldn't load this incident."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadIncident).toHaveBeenCalledTimes(1);
  });

  it("shows the no-access state on a 403", () => {
    state({
      incident: failed(
        new ApiError(403, { code: "forbidden", message: "forbidden" }),
        reloadIncident,
      ),
    });
    render(<IncidentDetailPage />);
    expect(
      screen.getByText("You don't have access to this incident."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("shows the timeline error, not 'No updates yet', when the timeline fails", () => {
    state({ timeline: failed(new Error("boom"), reloadTimeline) });
    render(<IncidentDetailPage />);
    expect(screen.getByText("Couldn't load the timeline.")).toBeInTheDocument();
    expect(screen.queryByText("No updates yet.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadTimeline).toHaveBeenCalledTimes(1);
  });

  it("shows the postmortem error when the postmortem fails", () => {
    state({
      postmortem: failed(new Error("boom"), reloadPostmortem),
    });
    render(<IncidentDetailPage />);
    expect(
      screen.getByText("Couldn't load the postmortem."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadPostmortem).toHaveBeenCalledTimes(1);
  });
});
