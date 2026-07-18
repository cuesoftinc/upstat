import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UptimeCard } from "./UptimeCard";

describe("UptimeCard", () => {
  it("renders one bar per day with the uptime %", () => {
    const days = Array.from({ length: 90 }, (_, i) => ({
      date: `2026-04-${(i % 30) + 1}-${i}`,
      uptime_pct: 100,
      down_minutes: 0,
    }));
    render(<UptimeCard name="Homepage" days={days} uptimePct={99.987} />);
    expect(screen.getByRole("img", { name: "Homepage 90-day uptime" }).children).toHaveLength(90);
    expect(screen.getByText("99.987%")).toBeInTheDocument();
  });

  it("shows — for nodata and renders the sparkline", () => {
    const days = [{ date: "2026-07-18", uptime_pct: null, down_minutes: 0 }];
    render(<UptimeCard name="Docs" days={days} uptimePct={null} sparkline={[100, 130, 90]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByLabelText("latency sparkline")).toBeInTheDocument();
  });
});
