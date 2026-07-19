import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopList } from "./TopList";

describe("TopList", () => {
  it("renders ranked bars and the empty state", () => {
    const { rerender } = render(
      <TopList entries={[{ label: "checkout", value: 42 }]} />,
    );
    expect(screen.getByText("checkout")).toBeInTheDocument();
    rerender(<TopList entries={[]} />);
    expect(screen.getByText("No data in range.")).toBeInTheDocument();
  });

  it("renders skeleton lines while loading", () => {
    const { container } = render(<TopList entries={[]} loading />);
    expect(container.querySelectorAll('[data-kind="line"]')).toHaveLength(5);
  });
});
