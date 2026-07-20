import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FunnelStageCard } from "./FunnelStageCard";

describe("FunnelStageCard", () => {
  it("renders label, abbreviated tnum count and share-of-previous meta", () => {
    render(
      <FunnelStageCard label="Page views" count={48200} pctOfPrevious={100} />,
    );
    expect(screen.getByText("Page views")).toBeInTheDocument();
    expect(screen.getByText("48.2k")).toBeInTheDocument();
    expect(screen.getByText("100% of previous stage")).toBeInTheDocument();
  });

  it("shows fractional conversion shares", () => {
    render(
      <FunnelStageCard
        label="Conversions — signup"
        count={1400}
        pctOfPrevious={11.2}
      />,
    );
    expect(screen.getByText("1.4k")).toBeInTheDocument();
    expect(screen.getByText("11.2% of previous stage")).toBeInTheDocument();
  });
});
