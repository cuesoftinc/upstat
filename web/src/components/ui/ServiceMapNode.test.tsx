import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceMapNode } from "./ServiceMapNode";

describe("ServiceMapNode", () => {
  it("carries state + metrics in the accessible name", () => {
    render(<ServiceMapNode name="checkout" reqPerS={42.5} errorRate={0.12} selected />);
    expect(
      screen.getByRole("button", { name: "checkout: 42.5 req/s, 12.0% errors" }),
    ).toHaveAttribute("data-state", "selected");
  });

  it("flips to erroring above the 5% ring threshold", () => {
    const { rerender } = render(<ServiceMapNode name="web" reqPerS={10} errorRate={0.01} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "healthy");
    rerender(<ServiceMapNode name="web" reqPerS={10} errorRate={0.2} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "erroring");
  });
});
