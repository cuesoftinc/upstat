import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SavedViewChip } from "./SavedViewChip";

describe("SavedViewChip", () => {
  it("shows the shared avatar stack and active state (MI-18)", () => {
    render(<SavedViewChip name="prod errors" sharedWith={["Kemi", "Tola"]} active />);
    expect(screen.getByRole("button", { name: /prod errors/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders the personal variant without a stack", () => {
    const { container } = render(<SavedViewChip name="mine" />);
    expect(container.querySelectorAll("span[title]")).toHaveLength(0);
  });
});
