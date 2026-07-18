import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("breathes only while crit (MI-8)", () => {
    const { container, rerender } = render(<StatusPill status="crit" />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    rerender(<StatusPill status="ok" />);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("keeps an accessible label in dot-only mode", () => {
    render(<StatusPill status="paused" dotOnly />);
    expect(screen.getByText("paused")).toHaveClass("sr-only");
  });

  it("renders all six statuses", () => {
    for (const status of ["ok", "warn", "crit", "nodata", "paused", "pending"] as const) {
      const { container, unmount } = render(<StatusPill status={status} />);
      expect(container.querySelector(`[data-status="${status}"]`)).not.toBeNull();
      unmount();
    }
  });
});
