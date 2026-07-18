import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Span } from "@/models";
import { TraceMinimap } from "./TraceMinimap";

const SPANS: Span[] = [
  {
    trace_id: "t",
    span_id: "a",
    parent_id: null,
    service: "api-common",
    name: "root",
    start: "2026-07-18T11:18:00.000Z",
    duration_ns: 48_200_000,
    status: "ok",
    attrs: {},
  },
  {
    trace_id: "t",
    span_id: "b",
    parent_id: "a",
    service: "clickhouse",
    name: "insert",
    start: "2026-07-18T11:18:00.012Z",
    duration_ns: 22_400_000,
    status: "ok",
    attrs: {},
  },
];

describe("TraceMinimap", () => {
  it("renders one bar per span", () => {
    render(<TraceMinimap spans={SPANS} durationMs={48.2} startTs="2026-07-18T11:18:00.000Z" />);
    expect(screen.getByRole("img", { name: "trace minimap" }).children).toHaveLength(2);
  });
});
