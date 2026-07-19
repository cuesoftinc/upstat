import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPageComponentRow } from "./StatusPageComponentRow";

describe("StatusPageComponentRow", () => {
  it("renders the 90-day strip", () => {
    const days = Array.from({ length: 90 }, (_, i) => ({
      date: `d${i}`,
      uptime_pct: 100,
      down_minutes: 0,
    }));
    render(
      <StatusPageComponentRow
        name="API"
        status="ok"
        days={days}
        uptimePct={99.99}
      />,
    );
    expect(
      screen.getByRole("img", { name: "API 90-day uptime" }).children,
    ).toHaveLength(90);
  });
});
