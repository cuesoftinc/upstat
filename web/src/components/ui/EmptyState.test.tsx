import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("offers the copyable snippet + docs link (MI-16)", () => {
    render(<EmptyState pillar="rum" />);
    expect(screen.getByText(/upstat.js/)).toBeInTheDocument();
    expect(screen.getByLabelText("Copy snippet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Setup docs/ }),
    ).toBeInTheDocument();
  });

  it("stops the sweep when data arrives", () => {
    render(<EmptyState pillar="metrics" waiting={false} />);
    expect(screen.getByText("First datapoint received")).toBeInTheDocument();
  });
});
