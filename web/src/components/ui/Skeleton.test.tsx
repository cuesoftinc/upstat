import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders each kind", () => {
    const { container, rerender } = render(<Skeleton kind="line" />);
    expect(container.querySelector('[data-kind="line"]')).not.toBeNull();
    rerender(<Skeleton kind="value" />);
    expect(container.querySelector('[data-kind="value"]')).not.toBeNull();
    rerender(<Skeleton kind="panel-axis" />);
    expect(container.querySelector('[data-kind="panel-axis"]')).not.toBeNull();
  });

  it("stays aria-hidden (pure loading decoration)", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
