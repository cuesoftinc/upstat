import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("marks the error state with aria-invalid", () => {
    render(<Input error aria-label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders mono for query/data inputs", () => {
    render(<Input mono aria-label="Query" />);
    expect(screen.getByLabelText("Query")).toHaveClass("font-data");
  });
});
