import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryValue } from "./QueryValue";

describe("QueryValue", () => {
  it("shows the delta chip and threshold tint", () => {
    const { container } = render(
      <QueryValue value="142 ms" deltaPct={-3.4} threshold="warn" />,
    );
    // Figma 70:537 — tint wash carries the threshold, the value stays neutral
    expect(screen.getByText("142 ms")).toHaveClass("text-text");
    expect(container.querySelector(".bg-warn\\/8")).not.toBeNull();
    expect(screen.getByText("▼ 3.4%")).toHaveClass("text-warn-text");
  });

  it("renders the sparkline variant", () => {
    const { container } = render(
      <QueryValue value="3.4k" sparkline={[1, 5, 3, 8]} />,
    );
    expect(container.querySelector("polyline")).not.toBeNull();
  });
});
