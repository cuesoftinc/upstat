import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Slo } from "@/models";
import { SLOCard } from "./SLOCard";

const SLO: Slo = {
  id: "slo_1",
  org_id: "org",
  name: "Checkout p95",
  sli_source: "latency",
  target: 99,
  window: "30d",
  current: 98.91,
  budget_remaining_pct: 11,
  burn_rate: 6.2,
  state: "burning",
};

describe("SLOCard", () => {
  it("captions are per-state (master 48:95)", () => {
    const { rerender } = render(<SLOCard slo={SLO} />);
    // burning: escalation copy
    expect(
      screen.getByText("burn rate 6.2× — page on-call"),
    ).toBeInTheDocument();
    // healthy: the budget formula
    rerender(<SLOCard slo={{ ...SLO, state: "healthy", burn_rate: 0.4 }} />);
    expect(
      screen.getByText("error budget 11% left · burn 0.4×"),
    ).toBeInTheDocument();
    // exhausted: when the budget hit zero
    rerender(
      <SLOCard
        slo={{
          ...SLO,
          state: "exhausted",
          budget_remaining_pct: 0,
          exhausted_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        }}
      />,
    );
    expect(screen.getByText("budget exhausted 3d ago")).toBeInTheDocument();
  });

  it("renders the burning state with flame + meter (MI-15)", () => {
    render(<SLOCard slo={SLO} />);
    expect(
      screen.getByLabelText("burn rate above threshold"),
    ).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "11");
  });

  it("tints exhausted attainment crit and hides the flame when healthy", () => {
    const { rerender } = render(
      <SLOCard slo={{ ...SLO, state: "exhausted", budget_remaining_pct: 0 }} />,
    );
    expect(screen.getByText("98.91%")).toHaveClass("text-crit");
    rerender(<SLOCard slo={{ ...SLO, state: "healthy", burn_rate: 0.4 }} />);
    expect(screen.queryByLabelText("burn rate above threshold")).toBeNull();
  });
});
