import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MARKETING_PILLARS, PillarCard } from "./PillarCard";

describe("PillarCard", () => {
  it("defines all 8 pillars", () => {
    expect(MARKETING_PILLARS).toHaveLength(8);
    render(<PillarCard {...MARKETING_PILLARS[0]} />);
    expect(screen.getByText("Uptime & Synthetics")).toBeInTheDocument();
  });

  it("hides the description in the compact (dropdown) variant", () => {
    render(<PillarCard {...MARKETING_PILLARS[0]} compact />);
    expect(screen.queryByText(MARKETING_PILLARS[0].description)).toBeNull();
  });
});
