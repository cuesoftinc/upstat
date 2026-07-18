import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Span } from "@/models";
import { SpanRow } from "./SpanRow";

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

describe("SpanRow", () => {
  it("selects and reports hover (MI-7)", async () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    render(
      <SpanRow
        span={SPAN}
        depth={1}
        colorIndex={2}
        offsetFrac={0.2}
        widthFrac={0.4}
        onSelect={onSelect}
        onHover={onHover}
      />,
    );
    await userEvent.hover(screen.getByRole("button"));
    expect(onHover).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("tints error spans", () => {
    render(
      <SpanRow
        span={{ ...SPAN, status: "error" }}
        depth={0}
        colorIndex={0}
        offsetFrac={0}
        widthFrac={1}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-status", "error");
  });
});
