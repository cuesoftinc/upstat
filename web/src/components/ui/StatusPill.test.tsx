import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColorVisionProvider } from "@/design/ColorVisionProvider";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("breathes only while crit (MI-8)", () => {
    const { container, rerender } = render(<StatusPill status="crit" />);
    expect(container.querySelector("[class*='breathe']")).not.toBeNull();
    rerender(<StatusPill status="ok" />);
    expect(container.querySelector("[class*='breathe']")).toBeNull();
  });

  it("keeps an accessible label in dot-only mode", () => {
    render(<StatusPill status="paused" dotOnly />);
    expect(screen.getByText("PAUSED")).toHaveClass("sr-only");
  });

  it("renders all six statuses", () => {
    for (const status of [
      "ok",
      "warn",
      "crit",
      "nodata",
      "paused",
      "pending",
    ] as const) {
      const { container, unmount } = render(<StatusPill status={status} />);
      expect(
        container.querySelector(`[data-status="${status}"]`),
      ).not.toBeNull();
      unmount();
    }
  });
});

describe("StatusPill — §5 colorblind mode (glyph differentiation)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const renderWithPatterns = (ui: React.ReactElement) => {
    window.localStorage.setItem("upstat.colorvision", "patterns");
    return render(<ColorVisionProvider>{ui}</ColorVisionProvider>);
  };

  it("dot-only pills swap the plain dot for a per-status glyph", () => {
    const { container } = renderWithPatterns(
      <StatusPill status="crit" dotOnly />,
    );
    expect(container.querySelector('[data-glyph="crit"]')).not.toBeNull();
    // the accessible label stays
    expect(screen.getByText("CRIT")).toHaveClass("sr-only");
  });

  it("each status gets a distinct glyph in patterns mode", () => {
    const seen = new Set<string>();
    for (const status of [
      "ok",
      "warn",
      "crit",
      "nodata",
      "paused",
      "pending",
    ] as const) {
      const { container, unmount } = renderWithPatterns(
        <StatusPill status={status} dotOnly />,
      );
      const glyph = container.querySelector(`[data-glyph="${status}"]`);
      expect(glyph).not.toBeNull();
      seen.add(glyph!.innerHTML);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it("labeled pills keep the plain dot (text already differentiates)", () => {
    const { container } = renderWithPatterns(<StatusPill status="ok" />);
    expect(container.querySelector("[data-glyph]")).toBeNull();
  });

  it("without patterns mode the dot-only variant keeps the plain dot", () => {
    const { container } = render(<StatusPill status="ok" dotOnly />);
    expect(container.querySelector("[data-glyph]")).toBeNull();
  });
});
