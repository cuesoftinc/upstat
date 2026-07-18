import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trace } from "@/models";
import { TraceWaterfall } from "./TraceWaterfall";

const TRACE: Trace = {
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
  root_service: "api-common",
  root_name: "POST /v1/events",
  start: "2026-07-18T11:18:00.000Z",
  duration_ms: 48.2,
  span_count: 2,
  status: "ok",
  spans: [
    {
      trace_id: "9f86d081884c7d659a2feaa0c55ad015",
      span_id: "span_root",
      parent_id: null,
      service: "api-common",
      name: "POST /v1/events",
      start: "2026-07-18T11:18:00.000Z",
      duration_ns: 48_200_000,
      status: "ok",
      attrs: {},
    },
    {
      trace_id: "9f86d081884c7d659a2feaa0c55ad015",
      span_id: "span_insert",
      parent_id: "span_root",
      service: "clickhouse",
      name: "clickhouse.insert",
      start: "2026-07-18T11:18:00.012Z",
      duration_ns: 22_400_000,
      status: "ok",
      attrs: { table: "events" },
    },
  ],
};

describe("TraceWaterfall", () => {
  it("renders span rows and opens the drawer on click", async () => {
    render(<TraceWaterfall trace={TRACE} />);
    const rows = screen.getAllByRole("button", { name: /clickhouse.insert|POST \/v1\/events/ });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getByRole("button", { name: /clickhouse.insert/ }));
    expect(screen.getByRole("tab", { name: "tags" })).toBeInTheDocument();
  });
});
