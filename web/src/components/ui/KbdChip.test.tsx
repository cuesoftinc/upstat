import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KbdChip } from "./KbdChip";

describe("KbdChip", () => {
  it("renders chords as separate keys (MI-17)", () => {
    render(<KbdChip keys="g d" />);
    expect(screen.getByText("g")).toBeInTheDocument();
    expect(screen.getByText("d")).toBeInTheDocument();
    expect(screen.getByText("then")).toBeInTheDocument();
  });

  it("renders a single key without the chord separator", () => {
    render(<KbdChip keys="/" />);
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.queryByText("then")).toBeNull();
  });
});
