import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type Widget } from "@/models";

const { reload, data } = vi.hoisted(() => ({
  reload: vi.fn(),
  data: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/widgets", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/widgets")>(
    "@/controllers/widgets",
  );
  return { ...actual, useWidgetData: () => data.current };
});

import { WidgetBody } from "./widget-body";

function widget(type: Widget["type"]): Widget {
  return {
    id: "w_1",
    dashboard_id: "dash_1",
    type,
    title: "Checkout widget",
    query: null,
    query_string: "metric:http.request.duration_ms | p95() by service",
    viz_options: {},
    layout: { x: 0, y: 0, w: 6, h: 3 },
  };
}

function failed(error: Error) {
  return { data: null, loading: false, error, reload };
}

function renderBody(type: Widget["type"]) {
  render(
    <WidgetBody
      widget={widget(type)}
      vars={{}}
      cursor={null}
      onCursorChange={() => {}}
      onZoomRange={() => {}}
      onZoomReset={() => {}}
      height={200}
    />,
  );
}

describe("WidgetBody load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state with a working retry on a query-based widget", () => {
    data.current = { query: failed(new Error("boom")) };
    renderBody("timeseries");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load this widget.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the error state when a non-query source fails (SLO)", () => {
    data.current = { slos: failed(new Error("boom")) };
    renderBody("slo");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load this widget.",
    );
    expect(screen.queryByText("No SLOs defined.")).not.toBeInTheDocument();
  });

  it("shows the no-access state on a 403", () => {
    data.current = {
      query: failed(
        new ApiError(403, { code: "forbidden", message: "forbidden" }),
      ),
    };
    renderBody("timeseries");
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to this widget.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
