import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LevelChip } from "./LevelChip";

describe("LevelChip", () => {
  it("applies the decided level mapping (INFO → brand)", () => {
    render(<LevelChip level="INFO" />);
    expect(screen.getByText("INFO")).toHaveClass("text-brand-text");
  });

  it("keeps ERROR/WARN on crit/warn and TRACE on nodata", () => {
    const { rerender } = render(<LevelChip level="ERROR" />);
    expect(screen.getByText("ERROR")).toHaveClass("text-crit-text");
    rerender(<LevelChip level="WARN" />);
    expect(screen.getByText("WARN")).toHaveClass("text-warn-text");
    rerender(<LevelChip level="TRACE" />);
    expect(screen.getByText("TRACE")).toHaveClass("text-nodata-text");
  });
});
