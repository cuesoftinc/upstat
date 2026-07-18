import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Span } from "@/models";
import { SpanDrawer } from "./SpanDrawer";

const SPAN: Span = {
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
  span_id: "span_insert",
  parent_id: "span_root",
  service: "clickhouse",
  name: "clickhouse.insert",
  start: "2026-07-18T11:18:00.012Z",
  duration_ns: 22_400_000,
  status: "ok",
  attrs: { table: "events" },
};

describe("SpanDrawer", () => {
  it("switches tags / logs / process tabs", async () => {
    render(<SpanDrawer span={SPAN} onClose={() => undefined} />);
    expect(screen.getByText("table")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "process" }));
    expect(screen.getByText("span_insert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /logs/ }));
    expect(screen.getByText("No logs within this span.")).toBeInTheDocument();
  });
});
