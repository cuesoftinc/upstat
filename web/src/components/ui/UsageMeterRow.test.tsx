import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageMeterRow } from "./UsageMeterRow";

const METER = {
  pillar: "logs" as const,
  label: "Logs — ingested",
  value: 900_000_000,
  display: "0.90 GB",
  peak: 1_440_000_000,
  plan: "Self-host: unlimited · Cloud: announced at GA",
};

describe("UsageMeterRow", () => {
  it("renders label, tnum value and the verbatim plan column", () => {
    render(<UsageMeterRow meter={METER} />);
    expect(screen.getByText("Logs — ingested")).toBeInTheDocument();
    expect(screen.getByText("0.90 GB")).toBeInTheDocument();
    // accuracy canon: the plan copy is verbatim, never paraphrased
    expect(
      screen.getByText("Self-host: unlimited · Cloud: announced at GA"),
    ).toBeInTheDocument();
  });

  it("scales the bar against the trailing-3-month peak", () => {
    render(<UsageMeterRow meter={METER} />);
    const meterEl = screen.getByRole("meter");
    expect(meterEl).toHaveAttribute("aria-valuenow", "62.5");
    const fill = meterEl.querySelector(".bg-brand") as HTMLElement;
    expect(fill.style.width).toBe("62.5%");
  });

  it("clamps at 100% when MTD already exceeds the peak", () => {
    render(<UsageMeterRow meter={{ ...METER, value: 2_000_000_000 }} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
  });
});
