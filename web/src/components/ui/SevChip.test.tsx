import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SevChip } from "./SevChip";

describe("SevChip", () => {
  it("renders SEV-n across the three severities", () => {
    const { rerender } = render(<SevChip sev={1} />);
    expect(screen.getByText("SEV-1")).toHaveAttribute("data-sev", "1");
    rerender(<SevChip sev={2} />);
    expect(screen.getByText("SEV-2")).toBeInTheDocument();
    rerender(<SevChip sev={3} />);
    expect(screen.getByText("SEV-3")).toBeInTheDocument();
  });
});
